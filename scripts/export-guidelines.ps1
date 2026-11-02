# Rebuild the readable web edition from the original DOCX without third-party tools.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repoRoot = Split-Path -Parent $PSScriptRoot
$documentPath = Join-Path $repoRoot 'assets/documents/AndHub_Engineering_Brand_Guidelines_v1.docx'
$imageDirectory = Join-Path $repoRoot 'assets/images/guide'
[IO.Directory]::CreateDirectory($imageDirectory) | Out-Null
$archive = [IO.Compression.ZipFile]::OpenRead($documentPath)
try {
    function Read-ArchiveXml([string]$entryName) {
        $reader = [IO.StreamReader]::new($archive.GetEntry($entryName).Open())
        try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
    }
    $document = Read-ArchiveXml 'word/document.xml'
    $relations = Read-ArchiveXml 'word/_rels/document.xml.rels'
    $ns = [Xml.XmlNamespaceManager]::new($document.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $ns.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $ns.AddNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main')
    $targets = @{}
    foreach ($relation in $relations.Relationships.Relationship) { $targets[$relation.Id] = $relation.Target }
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName -like 'word/media/*' -and $entry.Name) {
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $imageDirectory $entry.Name), $true)
        }
    }
    function Encode([string]$value) { return [Net.WebUtility]::HtmlEncode($value) }
    function Convert-Inline($node) {
        if ($node.LocalName -eq 't') { return (Encode $node.InnerText) }
        if ($node.LocalName -eq 'br' -and $node.GetAttribute('type', $ns.LookupNamespace('w')) -ne 'page') { return '<br>' }
        if ($node.LocalName -eq 'tab') { return ' ' }
        if ($node.LocalName -in @('pPr','rPr','drawing','sectPr')) { return '' }
        $content = ($node.ChildNodes | ForEach-Object { Convert-Inline $_ }) -join ''
        if ($node.LocalName -eq 'hyperlink') {
            $target = $targets[$node.GetAttribute('id', $ns.LookupNamespace('r'))]
            if ($target -match '^https://') { return '<a href="' + (Encode $target) + '">' + $content + '</a>' }
        }
        if ($node.LocalName -eq 'r' -and $node.SelectSingleNode('w:rPr/w:b', $ns)) { return '<strong>' + $content + '</strong>' }
        return $content
    }
    $toc = [Collections.Generic.List[string]]::new()
    $headingIds = @{}
    function Convert-Paragraph($paragraph) {
        $content = Convert-Inline $paragraph
        $images = $paragraph.SelectNodes('.//a:blip', $ns)
        $html = ''
        foreach ($blip in $images) {
            $imageName = [IO.Path]::GetFileName($targets[$blip.GetAttribute('embed', $ns.LookupNamespace('r'))])
            $html += '<figure><img src="../assets/images/guide/' + (Encode $imageName) + '" loading="lazy" alt="Illustration from the original brand guide; explained in the adjacent text"></figure>'
        }
        if (-not ($content -replace '<[^>]*>', '').Trim()) { return $html }
        $styleNode = $paragraph.SelectSingleNode('w:pPr/w:pStyle', $ns)
        $style = if ($styleNode) { $styleNode.GetAttribute('val', $ns.LookupNamespace('w')) } else { '' }
        $tag = switch ($style) { 'Title' {'h1'} 'Heading1' {'h2'} 'Heading2' {'h3'} default {'p'} }
        $attributes = ''
        if ($tag -eq 'h2') {
            $text = ($paragraph.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
            $id = (($text.ToLowerInvariant() -replace '[^a-z0-9]+', '-') -replace '^-|-$', '')
            if ($headingIds.ContainsKey($id)) { throw "Duplicate heading: $id" }
            $headingIds[$id] = $true
            $attributes = ' id="' + $id + '"'
            $toc.Add('<li><a href="#' + $id + '">' + (Encode $text) + '</a></li>')
        } elseif ($style -match '^(Kicker|Lead|Subtitle|Caption|Small)$') {
            $attributes = ' class="' + $style.ToLowerInvariant() + '"'
        }
        return $html + '<' + $tag + $attributes + '>' + $content + '</' + $tag + '>'
    }
    $blocks = [Collections.Generic.List[string]]::new()
    foreach ($node in $document.SelectSingleNode('//w:body', $ns).ChildNodes) {
        if ($node.LocalName -eq 'p') { $blocks.Add((Convert-Paragraph $node)) }
        elseif ($node.LocalName -eq 'tbl') {
            $table = '<div class="table-wrap"><table>'
            $rowIndex = 0
            foreach ($row in $node.SelectNodes('w:tr', $ns)) {
                $table += '<tr>'
                foreach ($cell in $row.SelectNodes('w:tc', $ns)) {
                    $tag = if ($rowIndex -eq 0) { 'th' } else { 'td' }
                    $spanNode = $cell.SelectSingleNode('w:tcPr/w:gridSpan', $ns)
                    $span = if ($spanNode) { ' colspan="' + $spanNode.GetAttribute('val', $ns.LookupNamespace('w')) + '"' } else { '' }
                    $scope = if ($tag -eq 'th') { ' scope="col"' } else { '' }
                    $table += '<' + $tag + $span + $scope + '>'
                    foreach ($p in $cell.SelectNodes('w:p', $ns)) { $table += Convert-Paragraph $p }
                    $table += '</' + $tag + '>'
                }
                $table += '</tr>'
                $rowIndex++
            }
            $blocks.Add($table + '</table></div>')
        }
    }
    $body = $blocks -join "`n"
    # The document's visual source was a plain-text reference; make it navigable.
    $body = $body.Replace('“AndHub Engineering Brand Identity Board.png,”', '<a href="../assets/images/reference/AndHub%20Engineering%20Brand%20Identity%20Board.png">“AndHub Engineering Brand Identity Board.png,”</a>')
    $tocHtml = $toc -join "`n"
    $html = @"
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Complete Brand Guidelines — AndHub Engineering PLC</title><meta name="description" content="The complete AndHub brand guide, including foundation, voice, logos, colors, typography, applications, governance and references."><link rel="icon" href="../assets/web-kit/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="../assets/styles/site.css"></head>
<body><a class="skip-link" href="#main">Skip to content</a><main class="document-shell" id="main">
<nav class="document-nav" aria-label="Page navigation"><a href="../index.html">← Brand guidelines home</a><a href="index.html">Documentation index</a><a href="../assets/documents/AndHub_Engineering_Brand_Guidelines_v1.pdf">Original PDF ↗</a></nav>
<aside class="document-intro"><strong>Web edition / Version 1.0.</strong> This is a readable transcription of the original proposed guide. Its references to vector masters describe the requirements when it was written. Reconstructed SVG, PNG and icon assets are now in the <a href="../assets.html">logo library</a>; they still require approval. Original <a href="../assets/documents/AndHub_Engineering_Brand_Guidelines_v1.docx" download>DOCX</a> and <a href="../assets/documents/AndHub_Engineering_Brand_Guidelines_v1.pdf">PDF</a> remain available. Companion <a href="../assets/documents/AndHub_Brand_Tokens_v1.css" download>CSS tokens</a> implement the proposed defaults. The expanded library now includes <a href="../assets.html?category=fonts">licensed fonts</a>, <a href="../assets.html?category=templates">editable templates</a> and <a href="../assets.html?category=qr">branded QR downloads</a>. Current company contacts are in the <a href="company.html">company profile</a>.</aside>
<nav class="document-toc" aria-label="On this page"><strong>In this guide</strong><ol>$tocHtml</ol></nav>
<article class="document-body">$body</article>
<footer class="footer"><p>AndHub Engineering PLC · Proposed standards for adoption</p><a href="../index.html">Return to the brand guide →</a></footer>
</main></body></html>
"@
    [IO.File]::WriteAllText((Join-Path $repoRoot 'docs/guidelines.html'), $html + "`n", [Text.UTF8Encoding]::new($false))
    Write-Output "Exported $($toc.Count) chapters and 8 illustrations to docs/guidelines.html."
} finally { $archive.Dispose() }
