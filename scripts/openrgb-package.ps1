param([string]$Archive,[string]$Provenance)

function Assert-NexusHeadlessArchive([string]$ArchivePath,[string]$ProvenancePath) {
  Add-Type -AssemblyName System.IO.Compression,System.IO.Compression.FileSystem
  $record=Get-Content -LiteralPath $ProvenancePath -Raw | ConvertFrom-Json
  if($record.repository -ne 'hello-nexus/openrgb-headless' -or $record.commit -notmatch '^[a-f0-9]{40}$' -or $record.archiveSHA256 -notmatch '^[a-f0-9]{64}$'){throw 'Origem OpenRGB invalida.'}
  if((Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.archiveSHA256){throw 'Integridade do ZIP OpenRGB invalida.'}
  $required=@('OpenRGB-headless.exe','PawnIOLib.dll','hidapi-hotplug.dll','libusb-1.0.dll','LpcIO.bin','SmbusI801.bin','SmbusPIIX4.bin','SmbusNCT6793.bin','msvcp140.dll','msvcp140_codecvt_ids.dll','vcruntime140.dll','vcruntime140_1.dll','LICENSE-OpenRGB.txt')
  $zip=[IO.Compression.ZipFile]::OpenRead($ArchivePath)
  try {
    $seen=@{}; $total=0L
    foreach($entry in $zip.Entries) {
      $name=$entry.FullName
      if($name -match '(^|[\\/])(?:WinRing.*\.(?:sys|dll)|Qt\d.*\.dll)$'){throw 'Biblioteca Qt/WinRing nao permitida no pacote headless.'}
      if($name -match '[\\/:]' -or $name -eq '.' -or $name -eq '..' -or $seen.ContainsKey($name)){throw 'Caminho ou arquivo duplicado no pacote headless.'}
      $seen[$name]=$true; $total+=$entry.Length
      if($entry.Length -gt 32MB -or $total -gt 64MB){throw 'Pacote headless acima do limite.'}
      $expected=@($record.files | Where-Object {$_.name -ceq $name})
      if($expected.Count -ne 1 -or $expected[0].size -ne $entry.Length){throw ('Arquivo OpenRGB inesperado: '+$name)}
      $stream=$entry.Open(); $sha=[Security.Cryptography.SHA256]::Create()
      try {$actual=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}
      finally {$sha.Dispose();$stream.Dispose()}
      if($actual -ne $expected[0].sha256){throw ('Integridade OpenRGB invalida: '+$name)}
      if($name -match '\.(exe|dll)$') {
        $stream=$entry.Open();$memory=[IO.MemoryStream]::new()
        try {$stream.CopyTo($memory);$bytes=$memory.ToArray()} finally {$stream.Dispose();$memory.Dispose()}
        if($bytes.Length -lt 64 -or $bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a){throw ('PE OpenRGB invalido: '+$name)}
        $pe=[BitConverter]::ToInt32($bytes,60)
        if($pe -lt 64 -or $pe -gt ($bytes.Length-6) -or [BitConverter]::ToUInt32($bytes,$pe) -ne 0x4550 -or [BitConverter]::ToUInt16($bytes,$pe+4) -ne 0x8664){throw ('Binario OpenRGB nao e Windows x64: '+$name)}
      }
    }
    foreach($name in $required){if(-not $seen.ContainsKey($name)){throw ('Modulo OpenRGB obrigatorio ausente: '+$name)}}
    if($zip.Entries.Count -ne @($record.files).Count){throw 'Inventario OpenRGB incompleto.'}
  } finally {$zip.Dispose()}
}

if($Archive){if(-not $Provenance){throw 'Informe a origem do pacote.'};Assert-NexusHeadlessArchive $Archive $Provenance;Write-Output 'OpenRGB headless: origem, hashes, modulos e arquitetura conferidos.'}
