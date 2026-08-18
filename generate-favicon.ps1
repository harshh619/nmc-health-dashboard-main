Add-Type -AssemblyName System.Drawing

function Create-Favicon($sourcePath, $outputPath) {
    $img = [System.Drawing.Image]::FromFile($sourcePath)
    $bmp = New-Object System.Drawing.Bitmap(256, 256)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, 256, 256)
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Icon)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

Create-Favicon "g:\Dashboard Work\11 Aug\nmc-health-dashboard-main\public\icon-512x512.png" "g:\Dashboard Work\11 Aug\nmc-health-dashboard-main\app\favicon.ico"
Write-Host "Favicon generated"
