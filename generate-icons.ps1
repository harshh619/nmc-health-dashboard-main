Add-Type -AssemblyName System.Drawing

$sourcePath = "g:\Dashboard Work\11 Aug\nmc-health-dashboard-main\public\logo.png"
$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)

function Create-SquareIcon($size, $outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Fill with transparent background (or white if we want)
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Calculate centering
    # Scaling to fit inside the square with some padding
    $padding = [int]($size * 0.1)
    $availableSize = $size - 2 * $padding
    
    $scaleX = $availableSize / $sourceImg.Width
    $scaleY = $availableSize / $sourceImg.Height
    $scale = [math]::Min($scaleX, $scaleY)
    
    $newWidth = [int]($sourceImg.Width * $scale)
    $newHeight = [int]($sourceImg.Height * $scale)
    
    $x = [int](($size - $newWidth) / 2)
    $y = [int](($size - $newHeight) / 2)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($sourceImg, $x, $y, $newWidth, $newHeight)
    
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $bmp.Dispose()
}

Create-SquareIcon 192 "g:\Dashboard Work\11 Aug\nmc-health-dashboard-main\public\icon-192x192.png"
Create-SquareIcon 512 "g:\Dashboard Work\11 Aug\nmc-health-dashboard-main\public\icon-512x512.png"

$sourceImg.Dispose()
Write-Host "Icons generated successfully."
