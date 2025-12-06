import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Lead Gun Admin Tool</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Google Maps lead verilerini web sitelerinden telefon ve email bilgileriyle zenginleştirin
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Gruplar</CardTitle>
            <CardDescription>
              Lead gruplarını görüntüleyin ve yönetin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/groups">
              <Button className="w-full">Grupları Görüntüle</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zenginleştirme</CardTitle>
            <CardDescription>
              Lead verilerini web sitelerinden zenginleştirin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/groups">
              <Button className="w-full" variant="outline">Zenginleştirmeyi Başlat</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loglar</CardTitle>
            <CardDescription>
              Enrichment işlemlerinin loglarını görüntüleyin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/logs">
              <Button className="w-full" variant="outline">Logları Görüntüle</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Özellikler</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Google Maps lead verilerini Supabase'den çekme</li>
              <li>Web sitelerini otomatik scrape etme (Light ve Hard mode)</li>
              <li>Telefon ve email bilgilerini regex ile çıkarma</li>
              <li>Duplicate kontrolü ile veritabanına kaydetme</li>
              <li>Gerçek zamanlı log takibi</li>
              <li>Batch işleme (100'erli gruplar halinde)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
