# Generates build/icon.png (1024x1024) — the source image electron-builder
# converts to .icns for the macOS app icon. Same design as make-icon.ps1:
# white knight glyph on a purple #863bff rounded square.
Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$bgColor = [System.Drawing.Color]::FromArgb(255, 134, 59, 255)
$bgBrush = New-Object System.Drawing.SolidBrush($bgColor)

$radius = [int]($size * 0.20)
$diam = $radius * 2
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $diam, $diam, 180, 90)
$path.AddArc($size - $diam, 0, $diam, $diam, 270, 90)
$path.AddArc($size - $diam, $size - $diam, $diam, $diam, 0, 90)
$path.AddArc(0, $size - $diam, $diam, $diam, 90, 90)
$path.CloseFigure()
$g.FillPath($bgBrush, $path)

$fontSize = [single]($size * 0.78)
$font = New-Object System.Drawing.Font("Segoe UI Symbol", $fontSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fgBrush = [System.Drawing.Brushes]::White
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$rect = New-Object System.Drawing.RectangleF(0, [single]($size * 0.02), [single]$size, [single]$size)
$glyph = [char]0x265E
$g.DrawString($glyph, $font, $fgBrush, $rect, $format)

$g.Dispose()
$bgBrush.Dispose()
$font.Dispose()
$path.Dispose()

$outPath = Join-Path $PSScriptRoot "icon.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Wrote $outPath ($((Get-Item $outPath).Length) bytes)"
