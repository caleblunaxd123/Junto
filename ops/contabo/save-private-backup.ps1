param(
  [Parameter(Mandatory=$true)][string]$RemoteBackup,
  [Parameter(Mandatory=$true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
if ($RemoteBackup -notmatch '^/opt/junto/backups/junto-[0-9]{8}T[0-9]{6}Z\.dump$') { throw 'Specify a reviewed JUNTO backup.' }
$taskDestination = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $taskDestination) { throw 'Refusing to replace an existing backup.' }
if (![IO.Directory]::Exists([IO.Path]::GetDirectoryName($taskDestination))) { throw 'Create the private destination directory first.' }
# The plaintext dump stays in memory; the only file written is DPAPI encrypted.
$taskStart = [Diagnostics.ProcessStartInfo]::new('ssh.exe')
$taskStart.UseShellExecute = $false
$taskStart.CreateNoWindow = $true
$taskStart.RedirectStandardOutput = $true
$taskStart.RedirectStandardError = $true
foreach ($taskArgument in @('-i','C:/Users/Caleb/.ssh/contabo_vps','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','deploy@217.216.82.43',"cat $RemoteBackup")) { $taskStart.ArgumentList.Add($taskArgument) }
$taskProcess = [Diagnostics.Process]::new()
$taskProcess.StartInfo = $taskStart
$taskMemory = [IO.MemoryStream]::new()
try {
  [void]$taskProcess.Start()
  $taskError = $taskProcess.StandardError.ReadToEndAsync()
  $taskProcess.StandardOutput.BaseStream.CopyTo($taskMemory)
  $taskProcess.WaitForExit()
  if ($taskProcess.ExitCode -ne 0) { throw 'SSH backup transfer failed; no backup file written.' }
  $taskPlain = $taskMemory.ToArray()
  if ($taskPlain.Length -lt 100 -or [Text.Encoding]::ASCII.GetString($taskPlain,0,5) -ne 'PGDMP') { throw 'Not a PostgreSQL custom-format dump.' }
  $taskScope = [Security.Cryptography.DataProtectionScope]::CurrentUser
  $taskCipher = [Security.Cryptography.ProtectedData]::Protect($taskPlain,$null,$taskScope)
  $taskRecovered = [Security.Cryptography.ProtectedData]::Unprotect($taskCipher,$null,$taskScope)
  $taskHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($taskPlain)).ToLowerInvariant()
  if ($taskHash -ne [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($taskRecovered)).ToLowerInvariant()) { throw 'Encrypted backup round-trip failed.' }
  [IO.File]::WriteAllBytes($taskDestination,$taskCipher)
  Write-Output "Encrypted external backup saved; recovery verified; plaintext SHA256=$taskHash"
} finally {
  if ($taskPlain) { [Array]::Clear($taskPlain,0,$taskPlain.Length) }
  if ($taskRecovered) { [Array]::Clear($taskRecovered,0,$taskRecovered.Length) }
  $taskMemory.Dispose(); $taskProcess.Dispose()
}
