Add-Type -AssemblyName System.Drawing

$buildDir = $PSScriptRoot
$sizes = @(256, 128, 64, 48, 32, 16)
$pngList = New-Object System.Collections.ArrayList

foreach ($size in $sizes) {
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
    if ($size -le 16) {
        $g.FillRectangle($bgBrush, 0, 0, $size, $size)
    } else {
        $path.AddArc(0, 0, $diam, $diam, 180, 90)
        $path.AddArc($size - $diam, 0, $diam, $diam, 270, 90)
        $path.AddArc($size - $diam, $size - $diam, $diam, $diam, 0, 90)
        $path.AddArc(0, $size - $diam, $diam, $diam, 90, 90)
        $path.CloseFigure()
        $g.FillPath($bgBrush, $path)
    }

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

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    [void]$pngList.Add($ms.ToArray())
    $ms.Dispose()
    $bmp.Dispose()
}

$icoPath = Join-Path $buildDir "icon.ico"
if (Test-Path $icoPath) { Remove-Item $icoPath -Force }
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$bw = New-Object System.IO.BinaryWriter($fs)

$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$sizes.Count)

$offset = 6 + (16 * $sizes.Count)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]
    $data = $pngList[$i]
    $wh = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $bw.Write($wh)
    $bw.Write($wh)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$data.Length)
    $bw.Write([uint32]$offset)
    $offset += $data.Length
}

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bw.Write([byte[]]$pngList[$i])
}

$bw.Close()
$fs.Close()

Write-Output "Wrote $icoPath ($((Get-Item $icoPath).Length) bytes)"
