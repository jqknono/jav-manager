# Script to generate app icon (ICO file) programmatically
# Requires Windows + .NET (System.Drawing)

param(
    [string]$OutputPath = "$PSScriptRoot\..\JavManager\Assets"
)

$ErrorActionPreference = "Stop"

# Simple ICO file generator using System.Drawing
Add-Type -AssemblyName System.Drawing

function New-AppIcon {
    param(
        [string]$OutputFile,
        [int[]]$Sizes = @(16, 24, 32, 48, 64, 128, 256)
    )

    # Base colors (keep in sync with `JavManager/Assets/icon.svg`)
    $bgColor = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)  # #2563eb
    $fgColor = [System.Drawing.Color]::White

    $icons = @()
    
    foreach ($size in $Sizes) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        
        # Scale factor
        $scale = $size / 512.0
        
        # Background rounded rectangle
        $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
        $margin = [int](16 * $scale)
        $rectSize = [int](480 * $scale)
        $cornerRadius = [int](80 * $scale)
        
        # Create rounded rectangle path
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $rect = New-Object System.Drawing.Rectangle($margin, $margin, $rectSize, $rectSize)
        
        if ($cornerRadius -gt 0) {
            $diameter = $cornerRadius * 2
            $arc = New-Object System.Drawing.Rectangle($rect.Location, (New-Object System.Drawing.Size($diameter, $diameter)))
            
            # Top left arc
            $path.AddArc($arc, 180, 90)
            
            # Top right arc
            $arc.X = $rect.Right - $diameter
            $path.AddArc($arc, 270, 90)
            
            # Bottom right arc
            $arc.Y = $rect.Bottom - $diameter
            $path.AddArc($arc, 0, 90)
            
            # Bottom left arc
            $arc.X = $rect.Left
            $path.AddArc($arc, 90, 90)
            
            $path.CloseFigure()
        } else {
            $path.AddRectangle($rect)
        }
        
        $graphics.FillPath($bgBrush, $path)
        
        # Film frame border
        $fgPen = New-Object System.Drawing.Pen($fgColor, [float](24 * $scale))
        $frameX = [int](96 * $scale)
        $frameY = [int](112 * $scale)
        $frameW = [int](320 * $scale)
        $frameH = [int](288 * $scale)
        $frameRadius = [int](16 * $scale)
        
        $framePath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $frameRect = New-Object System.Drawing.Rectangle($frameX, $frameY, $frameW, $frameH)
        if ($frameRadius -gt 0 -and $size -ge 32) {
            $fd = $frameRadius * 2
            $farc = New-Object System.Drawing.Rectangle($frameRect.Location, (New-Object System.Drawing.Size($fd, $fd)))
            $framePath.AddArc($farc, 180, 90)
            $farc.X = $frameRect.Right - $fd
            $framePath.AddArc($farc, 270, 90)
            $farc.Y = $frameRect.Bottom - $fd
            $framePath.AddArc($farc, 0, 90)
            $farc.X = $frameRect.Left
            $framePath.AddArc($farc, 90, 90)
            $framePath.CloseFigure()
        } else {
            $framePath.AddRectangle($frameRect)
        }
        $graphics.DrawPath($fgPen, $framePath)
        
        # Film perforations (simplified for small sizes)
        $fgBrush = New-Object System.Drawing.SolidBrush($fgColor)
        if ($size -ge 32) {
            $perfW = [int](32 * $scale)
            $perfH = [int](40 * $scale)
            $perfX1 = [int](64 * $scale)
            $perfX2 = [int](416 * $scale)
            $perfYs = @(136, 196, 256, 316)
            
            foreach ($py in $perfYs) {
                $perfY = [int]($py * $scale)
                $graphics.FillRectangle($fgBrush, $perfX1, $perfY, $perfW, $perfH)
                $graphics.FillRectangle($fgBrush, $perfX2, $perfY, $perfW, $perfH)
            }
        }
        
        # Play triangle in center
        $playPoints = @(
            (New-Object System.Drawing.PointF([float](224 * $scale), [float](192 * $scale))),
            (New-Object System.Drawing.PointF([float](224 * $scale), [float](320 * $scale))),
            (New-Object System.Drawing.PointF([float](336 * $scale), [float](256 * $scale)))
        )
        $graphics.FillPolygon($fgBrush, $playPoints)
        
        # Cleanup
        $graphics.Dispose()
        $bgBrush.Dispose()
        $fgBrush.Dispose()
        $fgPen.Dispose()
        $path.Dispose()
        $framePath.Dispose()
        
        $icons += $bitmap
    }
    
    # Create ICO file manually
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    
    # ICO header
    $bw.Write([int16]0)           # Reserved
    $bw.Write([int16]1)           # Type (1 = ICO)
    $bw.Write([int16]$icons.Count) # Number of images
    
    # Calculate offsets
    $headerSize = 6 + (16 * $icons.Count)
    $offset = $headerSize
    $imageData = @()
    
    foreach ($icon in $icons) {
        # Convert to PNG bytes
        $iconMs = New-Object System.IO.MemoryStream
        $icon.Save($iconMs, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $iconMs.ToArray()
        $iconMs.Dispose()
        $imageData += ,$pngBytes
        
        # ICO directory entry
        $w = if ($icon.Width -ge 256) { 0 } else { $icon.Width }
        $h = if ($icon.Height -ge 256) { 0 } else { $icon.Height }
        $bw.Write([byte]$w)        # Width
        $bw.Write([byte]$h)        # Height
        $bw.Write([byte]0)         # Color palette
        $bw.Write([byte]0)         # Reserved
        $bw.Write([int16]1)        # Color planes
        $bw.Write([int16]32)       # Bits per pixel
        $bw.Write([int32]$pngBytes.Length) # Size of image data
        $bw.Write([int32]$offset)  # Offset to image data
        
        $offset += $pngBytes.Length
    }
    
    # Write image data
    foreach ($data in $imageData) {
        $bw.Write($data)
    }
    
    # Save to file
    $bytes = $ms.ToArray()
    [System.IO.File]::WriteAllBytes($OutputFile, $bytes)
    
    # Cleanup
    $bw.Dispose()
    $ms.Dispose()
    foreach ($icon in $icons) {
        $icon.Dispose()
    }
    
    Write-Host "Created: $OutputFile"
}

# Generate ICO file
$icoPath = Join-Path $OutputPath "icon.ico"
New-AppIcon -OutputFile $icoPath

Write-Host "Icon generation complete!"
