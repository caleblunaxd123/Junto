# Synthetic OCR fixture, not a tax document or decorative app artwork.
Add-Type -AssemblyName System.Drawing
$qaBitmap = [System.Drawing.Bitmap]::new(800, 1000)
$qaGraphics = [System.Drawing.Graphics]::FromImage($qaBitmap)
$qaFont = [System.Drawing.Font]::new('Segoe UI', 26)
try {
  $qaGraphics.Clear([System.Drawing.Color]::White)
  $qaLines = @('BOLETA DE PRUEBA QA', 'NO VALIDA COMO COMPROBANTE', 'RESTAURANTE QA', '', '6 ALMUERZOS     S/ 180.00', '', 'SUBTOTAL       S/ 152.54', 'IGV            S/ 27.46', '', 'TOTAL          S/ 180.00', '', 'EFECTIVO       S/ 200.00', 'VUELTO         S/ 20.00', '', 'SIN PAGOS REALES')
  for ($qaIndex = 0; $qaIndex -lt $qaLines.Length; $qaIndex++) {
    $qaGraphics.DrawString($qaLines[$qaIndex], $qaFont, [System.Drawing.Brushes]::Black, 45, (45 + $qaIndex * 58))
  }
  $qaDestination = Join-Path $PSScriptRoot 'qa-receipt.png'
  $qaBitmap.Save($qaDestination, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $qaDestination
} finally { $qaFont.Dispose(); $qaGraphics.Dispose(); $qaBitmap.Dispose() }
