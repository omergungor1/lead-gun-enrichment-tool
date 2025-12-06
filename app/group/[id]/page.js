'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LeadList } from '@/components/LeadList'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function GroupDetailPage() {
  const params = useParams()
  const groupId = params.id
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (groupId) {
      fetchGroup()
    }
  }, [groupId])

  async function fetchGroup() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('lead_groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (error) throw error
      setGroup(data)
    } catch (err) {
      console.error('Group fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center p-8">
          <p className="text-destructive">Grup bulunamadı</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground mt-2">
            Grup detayları ve lead zenginleştirme işlemleri
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/groups">
            <Button variant="outline">Geri</Button>
          </Link>
          <Link href="/logs">
            <Button variant="outline">Loglar</Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Grup Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Toplam Lead</p>
              <p className="text-2xl font-bold">{group.lead_count || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Durum</p>
              <p className="text-lg font-semibold">{group.status}</p>
            </div>
            {group.order_note && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Sipariş Notu</p>
                <p className="text-sm">{group.order_note}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <LeadList groupId={groupId} />
    </div>
  )
}

