param([Parameter(Mandatory=$true)][string]$Label, [string]$Value, [switch]$SetText, [switch]$KeepKeyboard)
# Android SDK automation only. Labels must come from the observed native UI.
$qaAdb = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
& $qaAdb -s emulator-5554 shell uiautomator dump /sdcard/junto-qa.xml > $null
[xml]$qaUi = (& $qaAdb -s emulator-5554 shell cat /sdcard/junto-qa.xml)
$qaNode = $qaUi.SelectNodes('//node') | Where-Object { $_.GetAttribute('content-desc') -eq $Label } | Select-Object -First 1
if (!$qaNode -and !$SetText) { $qaNode = $qaUi.SelectNodes('//node') | Where-Object { $_.GetAttribute('text') -eq $Label } | Select-Object -First 1 }
if (!$qaNode) { throw "Control not visible: $Label" }
$qaBounds = [regex]::Match($qaNode.GetAttribute('bounds'), '^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$')
if (!$qaBounds.Success) { throw 'Invalid control bounds' }
if ([int]$qaBounds.Groups[4].Value -le [int]$qaBounds.Groups[2].Value -or [int]$qaBounds.Groups[3].Value -le [int]$qaBounds.Groups[1].Value) { throw 'Control has no visible area' }
$qaX = [int]( ([int]$qaBounds.Groups[1].Value + [int]$qaBounds.Groups[3].Value) / 2 )
$qaY = [int]( ([int]$qaBounds.Groups[2].Value + [int]$qaBounds.Groups[4].Value) / 2 )
if ($qaY -lt 64 -or $qaY -gt 2335) { throw 'Control is outside visible screen' }
Write-Output "$Label [$qaX,$qaY]"
& $qaAdb -s emulator-5554 shell input tap $qaX $qaY
if ($SetText) {
  & $qaAdb -s emulator-5554 shell input keyevent 123
  $qaKeys = @('input', 'keyevent') + (1..150 | ForEach-Object { '67' })
  & $qaAdb -s emulator-5554 shell @qaKeys
  & $qaAdb -s emulator-5554 shell input text $Value
  $qaIme = (& $qaAdb -s emulator-5554 shell dumpsys input_method) -join "`n"
  if (!$KeepKeyboard -and $qaIme -match 'mInputShown=true' -and $qaIme -match 'mIsInputViewShown=true') { & $qaAdb -s emulator-5554 shell input keyevent 4 }
}
