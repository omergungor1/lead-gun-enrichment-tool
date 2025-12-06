'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function LogConsole() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
    
    // Realtime subscription
    const channel = supabase
      .channel('leads_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('Lead updated:', payload)
          fetchLogs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchLogs() {
    try {
      setLoading(true)
      // Son 100 lead'in enrichment durumunu çek
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, website, enrichment_status, enrichment_error, enriched_at, updated_at')
        .not('enrichment_status', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(100)

      if (error) throw error

      // Log formatına çevir
      const formattedLogs = (data || []).map(lead => ({
        id: lead.id,
        name: lead.name,
        website: lead.website,
        status: lead.enrichment_status,
        error: lead.enrichment_error,
        timestamp: lead.enriched_at || lead.updated_at
      }))

      setLogs(formattedLogs)
    } catch (err) {
      console.error('Log fetch error:', err)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrichment Logları</CardTitle>
        <CardDescription>
          Son 100 enrichment işleminin logları (gerçek zamanlı güncellenir)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>İsim</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Hata</TableHead>
              <TableHead>Tarih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.name}</TableCell>
                <TableCell>
                  {log.website ? (
                    <a 
                      href={log.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {log.website.length > 30 ? log.website.substring(0, 30) + '...' : log.website}
                    </a>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(log.status)}>
                    {getStatusText(log.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {log.error || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : '-'}
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Henüz log bulunmuyor
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function getStatusVariant(status) {
  if (status === 'success') {
    return 'default'
  }
  if (status === 'failed') {
    return 'destructive'
  }
  return 'outline'
}

function getStatusText(status) {
  const statusMap = {
    success: 'Başarılı',
    failed: 'Başarısız',
    processing: 'İşleniyor'
  }
  return statusMap[status] || status
}

