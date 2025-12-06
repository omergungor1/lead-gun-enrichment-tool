import { GroupSelector } from '@/components/GroupSelector'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function GroupsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Lead Grupları</h1>
          <p className="text-muted-foreground mt-2">
            Tüm lead gruplarını görüntüleyin ve yönetin
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/">
            <Button variant="outline">Ana Sayfa</Button>
          </Link>
          <Link href="/logs">
            <Button variant="outline">Loglar</Button>
          </Link>
        </div>
      </div>
      <GroupSelector />
    </div>
  )
}

