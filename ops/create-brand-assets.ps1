# Deterministic rasterization of JUNTO's existing SVG mark, not AI artwork.
Add-Type -AssemblyName System.Drawing
$brandDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../apps/mobile/assets/brand'))
New-Item -ItemType Directory -Path $brandDirectory -Force | Out-Null
function New-BrandImage([string]$Name, [int]$Size, [float]$MarkSize, [bool]$Opaque, [bool]$Monochrome) {
  $brandBitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $brandGraphics = [System.Drawing.Graphics]::FromImage($brandBitmap)
  $brandBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($(if ($Monochrome) { '#FFFFFF' } else { '#00AD83' })))
  $brandPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  try {
    $brandGraphics.Clear($(if ($Opaque) { [System.Drawing.ColorTranslator]::FromHtml('#FFFCF7') } else { [System.Drawing.Color]::Transparent }))
    $brandGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $brandGraphics.TranslateTransform(($Size - $MarkSize) / 2, ($Size - $MarkSize) / 2)
    $brandGraphics.ScaleTransform($MarkSize / 60, $MarkSize / 60)
    $brandGraphics.FillEllipse($brandBrush, 11, 5, 14, 14)
    $brandGraphics.FillEllipse($brandBrush, 30, 0, 16, 16)
    $brandPath.AddBezier(14,23,8,25,1,39,3,47)
    $brandPath.AddBezier(3,47,5,53,13,51,18,44)
    $brandPath.AddBezier(18,44,21,55,32,56,35,47)
    $brandPath.AddBezier(35,47,22,49,23,42,23,32)
    $brandPath.AddBezier(23,32,24,24,19,21,14,23)
    $brandPath.CloseFigure()
    $brandPath.StartFigure()
    $brandPath.AddBezier(33,20,23,23,25,38,27,43)
    $brandPath.AddBezier(27,43,30,47,35,43,35,37)
    $brandPath.AddBezier(35,37,35,28,43,29,44,36)
    $brandPath.AddLine(44,36,47,47)
    $brandPath.AddBezier(47,47,50,55,60,50,58,43)
    $brandPath.AddLine(58,43,54,29)
    $brandPath.AddBezier(54,29,52,19,42,17,33,20)
    $brandPath.CloseFigure()
    $brandGraphics.FillPath($brandBrush, $brandPath)
    $brandBitmap.Save((Join-Path $brandDirectory $Name), [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "$Name ${Size}x${Size}"
  } finally { $brandPath.Dispose(); $brandBrush.Dispose(); $brandGraphics.Dispose(); $brandBitmap.Dispose() }
}
New-BrandImage 'icon-v2.png' 1024 660 $true $false
New-BrandImage 'adaptive-v2.png' 1024 580 $false $false
New-BrandImage 'splash-v2.png' 512 330 $false $false
New-BrandImage 'notification-v2.png' 96 84 $false $true
New-BrandImage 'favicon-v2.png' 96 64 $true $false
