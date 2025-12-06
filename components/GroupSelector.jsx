'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Upload } from 'lucide-react'

export function GroupSelector() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)

  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('lead_groups')
        .select('*')
        .eq('is_active', true)
        .eq('is_order', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setGroups(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-destructive">Hata: {error}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle>{group.name}</CardTitle>
              <CardDescription>
                {group.lead_count || 0} lead
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <Badge variant={getStatusVariant(group.status)}>
                    {getStatusText(group.status)}
                  </Badge>
                  {group.is_order && (
                    <Badge variant="outline">Sipariş</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {group.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedGroup(group)}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      CSV Yükle
                    </Button>
                  )}
                  <Link href={`/group/${group.id}`}>
                    <Button variant="outline" size="sm">Detaylar</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {groups.length === 0 && (
          <div className="col-span-full text-center p-8 text-muted-foreground">
            Henüz grup bulunmuyor
          </div>
        )}
      </div>

      {selectedGroup && (
        <CsvUploadModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onSuccess={() => {
            setSelectedGroup(null)
            fetchGroups()
          }}
        />
      )}
    </>
  )
}

function getStatusVariant(status) {
  switch (status) {
    case 'completed':
      return 'default'
    case 'processing':
      return 'secondary'
    case 'cancelled':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getStatusText(status) {
  const statusMap = {
    pending: 'Beklemede',
    processing: 'İşleniyor',
    completed: 'Tamamlandı',
    cancelled: 'İptal Edildi'
  }
  return statusMap[status] || status
}

// CSV Upload Modal Component
function CsvUploadModal({ group, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  // CSV kolon mapping
  const columnMapping = {
    'İşletme Adı': 'name',
    'İl': 'city',
    'İlçe': 'district',
    'Tam Adres': 'address',
    'Plus Code': 'plus_code',
    'Telefon': 'phone',
    'Web Sitesi': 'website',
    'Lat': 'lat',
    'Lng': 'lng',
    'Puan': 'rating',
    'Yorum Sayısı': 'review_count',
    'İşletme Türü': 'business_type',
    'Resim URL': 'profile_image_url',
    'Çalışma Saatleri': 'working_hours',
    'Google Maps URL': 'google_maps_url',
    'Arama Terimi': 'search_term'
  }

  function handleFileSelect(e) {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Lütfen CSV dosyası seçin')
      return
    }

    setFile(selectedFile)
    setError(null)

    // CSV'yi parse et ve preview göster
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const lines = text.split('\n').filter(line => line.trim())

        if (lines.length < 2) {
          setError('CSV dosyası boş veya geçersiz')
          return
        }

        // Header'ı parse et
        const headers = parseCsvLine(lines[0])

        // İlk 10 satırı parse et
        const previewData = []
        for (let i = 1; i < Math.min(11, lines.length); i++) {
          const values = parseCsvLine(lines[i])
          const row = {}
          headers.forEach((header, index) => {
            const dbColumn = columnMapping[header.trim()]
            if (dbColumn) {
              row[dbColumn] = values[index] || ''
            }
          })
          previewData.push(row)
        }

        setPreview({
          headers,
          data: previewData,
          totalRows: lines.length - 1
        })
      } catch (err) {
        setError(`CSV parse hatası: ${err.message}`)
      }
    }
    reader.readAsText(selectedFile, 'UTF-8')
  }

  function parseCsvLine(line) {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())

    return result
  }

  async function handleUpload() {
    if (!file || !preview) {
      setError('Lütfen önce CSV dosyası seçin')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // CSV'yi tekrar oku ve tüm veriyi parse et
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      const headers = parseCsvLine(lines[0])

      const leads = []
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i])
        const lead = {
          primary_group_id: group.id,
          is_active: true
        }

        headers.forEach((header, index) => {
          const dbColumn = columnMapping[header.trim()]
          if (dbColumn && values[index]) {
            const value = values[index].trim()

            if (dbColumn === 'rating') {
              lead[dbColumn] = parseFloat(value.replace(',', '.')) || null
            } else if (dbColumn === 'review_count') {
              lead[dbColumn] = parseInt(value) || null
            } else if (dbColumn === 'working_hours') {
              // JSON string'i parse et
              try {
                lead[dbColumn] = JSON.parse(value)
              } catch {
                lead[dbColumn] = null
              }
            } else if (dbColumn === 'lat' || dbColumn === 'lng') {
              // Lat/Lng formatını düzelt (402.127.553 -> 40.2127553)
              // Noktaları kaldır, ilk 2 haneyi al, sonra nokta koy, kalanı ekle
              const cleaned = value.replace(/\./g, '')
              if (cleaned.length >= 2 && /^\d+$/.test(cleaned)) {
                // İlk 2 hane + nokta + kalan
                lead[dbColumn] = cleaned.substring(0, 2) + '.' + cleaned.substring(2)
              } else {
                lead[dbColumn] = value
              }
            } else {
              lead[dbColumn] = value
            }
          }
        })

        // Company field'ını name'den al (eğer yoksa)
        if (!lead.company && lead.name) {
          lead.company = lead.name
        }

        leads.push(lead)
      }

      // API'ye gönder
      const response = await fetch('/api/upload-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          group_id: group.id,
          leads: leads
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload başarısız')
      }

      alert(`Başarılı! ${result.inserted} lead eklendi.`)
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>CSV Yükle - {group.name}</CardTitle>
            <CardDescription>
              CSV dosyasını seçin ve verileri kontrol edin
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            ×
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              CSV Dosyası Seç
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Toplam {preview.totalRows} kayıt bulundu (İlk 10 kayıt önizleme)
                </p>
              </div>

              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left border-b">İşletme Adı</th>
                      <th className="px-3 py-2 text-left border-b">İl</th>
                      <th className="px-3 py-2 text-left border-b">İlçe</th>
                      <th className="px-3 py-2 text-left border-b">Telefon</th>
                      <th className="px-3 py-2 text-left border-b">Web Sitesi</th>
                      <th className="px-3 py-2 text-left border-b">Puan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.map((row, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 py-2">{row.name || '-'}</td>
                        <td className="px-3 py-2">{row.city || '-'}</td>
                        <td className="px-3 py-2">{row.district || '-'}</td>
                        <td className="px-3 py-2">{row.phone || '-'}</td>
                        <td className="px-3 py-2">{row.website || '-'}</td>
                        <td className="px-3 py-2">{row.rating || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              İptal
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!preview || uploading}
            >
              {uploading ? 'Yükleniyor...' : 'Yükle'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

