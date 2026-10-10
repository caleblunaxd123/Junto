"""Narrow, recoverable host edits. Run only on the reviewed JUNTO Contabo host."""
import hashlib
import os
import pathlib
import shutil
import subprocess
import sys

STAMP = '20261010-beta'
HOST = pathlib.Path('/opt/junto')

def backup(path):
    target = path.with_name(path.name + '.' + STAMP + '.bak')
    if target.exists():
        raise RuntimeError('Backup already exists; inspect previous operation before retrying')
    if path.is_symlink() or not path.is_file():
        raise RuntimeError('Expected a regular configuration file')
    shutil.copy2(path, target)
    os.chmod(target, 0o600)
    return target

def update_env(path, key, value):
    content = path.read_text()
    lines = content.splitlines()
    indexes = [i for i, line in enumerate(lines) if line.startswith(key + '=')]
    if len(indexes) > 1:
        raise RuntimeError('Duplicate configuration key')
    backup(path)
    if indexes:
        lines[indexes[0]] = key + '=' + value
    else:
        lines.append(key + '=' + value)
    path.write_text('\n'.join(lines) + '\n')
    os.chmod(path, 0o600)

if sys.argv[1] == 'api':
    update_env(HOST / 'compose.env', 'JUNTO_IMAGE', 'junto-api:' + STAMP)
    update_env(HOST / 'runtime.env', 'BETA_WEB_URL', 'https://junto.lunalav.pe/app/')
    print('Updated JUNTO image and beta URL; private rollback copies retained.')
elif sys.argv[1] == 'caddy-candidate':
    path = pathlib.Path('/opt/stack/Caddyfile')
    content = path.read_bytes()
    expected = 'ded216ef16266087421fe93a1ce8c514afd193184f872353d0d11dee631119ca'
    if hashlib.sha256(content).hexdigest() != expected:
        raise RuntimeError('Caddyfile changed since review; refusing overwrite')
    original = 'junto.lunalav.pe {\n\tencode zstd gzip\n\treverse_proxy junto-api:3000\n}'
    replacement = 'junto.lunalav.pe {\n\tencode zstd gzip\n\t@beta path /app /app/*\n\thandle @beta {\n\t\treverse_proxy junto-beta-web:8080\n\t}\n\thandle {\n\t\treverse_proxy junto-api:3000\n\t}\n}'
    source = content.decode()
    if source.count(original) != 1:
        raise RuntimeError('Expected exactly the reviewed JUNTO block')
    candidate = pathlib.Path('/opt/junto-beta/Caddyfile.candidate')
    candidate.write_text(source.replace(original, replacement))
    print('Prepared candidate changing only JUNTO /app routing.')
elif sys.argv[1] == 'caddy-apply':
    path = pathlib.Path('/opt/stack/Caddyfile')
    expected = 'ded216ef16266087421fe93a1ce8c514afd193184f872353d0d11dee631119ca'
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise RuntimeError('Caddyfile changed since review; refusing overwrite')
    candidate = pathlib.Path('/opt/junto-beta/Caddyfile.candidate')
    rollback = backup(path)
    # Preserve the bind-mounted inode so Caddy reload sees the new content.
    path.write_bytes(candidate.read_bytes())
    try:
        subprocess.run(['docker', 'exec', 'caddy', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile'], check=True)
    except Exception:
        path.write_bytes(rollback.read_bytes())
        subprocess.run(['docker', 'exec', 'caddy', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile'], check=True)
        raise
    print('Reloaded only routes; original Caddyfile retained for rollback.')
else:
    raise RuntimeError('Unknown deployment phase')
