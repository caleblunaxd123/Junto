"""Inspect distribution files without printing private configuration values."""
import pathlib
import re
import sys
import zipfile
import hashlib

root = pathlib.Path(__file__).resolve().parents[2]
apk = pathlib.Path(sys.argv[1]).resolve()
web = pathlib.Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else None
secrets = []
for filename in ['apps/api/.env', 'apps/api/.env.smtp.local', 'apps/api/.env.deepseek.local']:
    file = root / filename
    if not file.exists():
        continue
    for line in file.read_text(encoding='utf-8-sig').splitlines():
        match = re.match(r'^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$', line)
        if not match:
            continue
        key, value = match.groups()
        value = value.strip('\"\'')
        if re.search(r'SECRET|API_KEY|SMTP_PASS|DATABASE_URL|TOKEN|PASSWORD', key) and len(value) >= 16:
            secrets.append((key, value.encode()))

def check(name, data):
    for key, value in secrets:
        if value in data:
            raise RuntimeError(f'Private configuration found in {name}: {key}')
    for marker in [b'fictional-native-qa', b'10.0.2.2:5105', b'Prueba UX aislada', b'JUNTO UX QA']:
        assert marker not in data, f'Native QA fixture found in {name}'

with zipfile.ZipFile(apk) as archive:
    names = archive.namelist()
    assert 'assets/index.android.bundle' in names
    assert any(n.startswith('lib/arm64-v8a/') for n in names)
    assert any(n.startswith('lib/x86_64/') for n in names)
    assert not any(re.search(r'(^|/)\.env|\.keystore$|\.map$', n) for n in names)
    for name in names:
        check(name, archive.read(name))
if web:
    for file in web.rglob('*'):
        if file.is_file() and file.suffix != '.apk':
            assert file.suffix != '.map'
            check(str(file.relative_to(web)), file.read_bytes())
print('PASS: bundled JS/ARM64/x86_64; no environments, keystores, source maps, native QA fixture or known local secrets in distribution.')
print('APK SHA-256:', hashlib.sha256(apk.read_bytes()).hexdigest())
