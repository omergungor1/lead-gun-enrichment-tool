'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

export function LeadList({ groupId }) {
    const [leads, setLeads] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [enriching, setEnriching] = useState(false)
    const [enrichmentProgress, setEnrichmentProgress] = useState({
        processed: 0,
        total: 0,
        success: 0,
        failed: 0,
        totalPhones: 0,
        totalEmails: 0
    })
    const [stats, setStats] = useState({
        total: 0,
        success: 0,
        failed: 0,
        pending: 0
    })

    useEffect(() => {
        if (groupId) {
            fetchLeads()
            fetchStats()
        }
    }, [groupId])

    async function fetchLeads() {
        try {
            setLoading(true)
            const { data: leadsData, error: leadsError } = await supabase
                .from('leads')
                .select('*')
                .eq('primary_group_id', groupId)
                .eq('is_active', true)
                .order('company', { ascending: true })
                .limit(100)

            if (leadsError) throw leadsError

            // Her lead için telefon ve email'leri çek
            const leadsWithData = await Promise.all(
                (leadsData || []).map(async (lead) => {
                    // Website telefonlarını çek (source='website')
                    const { data: phonesData } = await supabase
                        .from('lead_phones')
                        .select('phone, source')
                        .eq('lead_id', lead.id)
                    // .eq('source', 'website')

                    // Website email'lerini çek (source='website')
                    const { data: emailsData } = await supabase
                        .from('lead_emails')
                        .select('email')
                        .eq('lead_id', lead.id)
                        .eq('source', 'website')

                    return {
                        ...lead,
                        websitePhones: phonesData?.map(p => p.phone + '-' + p.source).join(', ') || '',
                        websiteEmails: emailsData?.map(e => e.email).join(', ') || ''
                    }
                })
            )

            setLeads(leadsWithData)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function fetchStats() {
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('enrichment_status, is_enriched')
                .eq('primary_group_id', groupId)
                .eq('is_active', true)

            if (error) throw error

            const stats = {
                total: data?.length || 0,
                success: data?.filter(l => l.enrichment_status === 'success' || l.is_enriched).length || 0,
                failed: data?.filter(l => l.enrichment_status === 'failed').length || 0,
                pending: data?.filter(l => !l.enrichment_status || (!l.is_enriched && l.enrichment_status !== 'failed')).length || 0
            }

            setStats(stats)
        } catch (err) {
            console.error('Stats fetch error:', err)
        }
    }

    async function fetchEnrichmentStats() {
        try {
            // Önce lead ID'lerini al
            const { data: leadsData } = await supabase
                .from('leads')
                .select('id, enrichment_status, is_enriched')
                .eq('primary_group_id', groupId)
                .eq('is_active', true)

            if (!leadsData || leadsData.length === 0) {
                return {
                    processed: 0,
                    total: 0,
                    success: 0,
                    failed: 0,
                    totalPhones: 0,
                    totalEmails: 0
                }
            }

            const leadIds = leadsData.map(l => l.id)

            // Toplam telefon sayısını al
            const { count: phonesCount } = await supabase
                .from('lead_phones')
                .select('*', { count: 'exact', head: true })
                .in('lead_id', leadIds)

            // Toplam email sayısını al (sadece website source)
            const { count: emailsCount } = await supabase
                .from('lead_emails')
                .select('*', { count: 'exact', head: true })
                .eq('source', 'website')
                .in('lead_id', leadIds)

            // İşlenen lead sayısını hesapla
            const processed = leadsData.filter(l =>
                l.enrichment_status === 'success' || l.is_enriched || l.enrichment_status === 'failed'
            ).length

            const success = leadsData.filter(l =>
                l.enrichment_status === 'success' || l.is_enriched
            ).length

            const failed = leadsData.filter(l =>
                l.enrichment_status === 'failed'
            ).length

            const total = leadsData.length

            return {
                processed,
                total,
                success,
                failed,
                totalPhones: phonesCount || 0,
                totalEmails: emailsCount || 0
            }
        } catch (err) {
            console.error('Enrichment stats fetch error:', err)
            return null
        }
    }

    async function handleEnrich() {
        try {
            setEnriching(true)

            // Başlangıç istatistiklerini al
            const initialStats = await fetchEnrichmentStats()
            if (initialStats) {
                setEnrichmentProgress({
                    ...initialStats,
                    total: stats.total || initialStats.total
                })
            } else {
                // Eğer stats alınamazsa, mevcut stats'ı kullan
                setEnrichmentProgress({
                    processed: 0,
                    total: stats.total || 0,
                    success: 0,
                    failed: 0,
                    totalPhones: 0,
                    totalEmails: 0
                })
            }

            // Polling interval başlat
            const progressInterval = setInterval(async () => {
                const currentStats = await fetchEnrichmentStats()
                if (currentStats) {
                    setEnrichmentProgress(currentStats)
                }
            }, 2000) // Her 2 saniyede bir güncelle

            const response = await fetch('/enrich/api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ group_id: groupId })
            })

            clearInterval(progressInterval)

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Enrichment başarısız')
            }

            // Son istatistikleri al
            const finalStats = await fetchEnrichmentStats()
            if (finalStats) {
                setEnrichmentProgress(finalStats)
            }

            // Verileri yenile
            await fetchLeads()
            await fetchStats()

            // 3 saniye sonra progress'i sıfırla
            setTimeout(() => {
                setEnrichmentProgress({
                    processed: 0,
                    total: 0,
                    success: 0,
                    failed: 0,
                    totalPhones: 0,
                    totalEmails: 0
                })
            }, 3000)
        } catch (err) {
            alert(`Hata: ${err.message}`)
        } finally {
            setEnriching(false)
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
        <div className="space-y-6">
            {/* İstatistikler */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Toplam Lead</CardDescription>
                        <CardTitle className="text-2xl">{stats.total}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Başarılı</CardDescription>
                        <CardTitle className="text-2xl text-green-600">{stats.success}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Başarısız</CardDescription>
                        <CardTitle className="text-2xl text-red-600">{stats.failed}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Beklemede</CardDescription>
                        <CardTitle className="text-2xl text-yellow-600">{stats.pending}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Zenginleştirme Butonu */}
            <Card>
                <CardHeader>
                    <CardTitle>Zenginleştirme İşlemi</CardTitle>
                    <CardDescription>
                        Seçilen gruptaki tüm leadleri zenginleştirmek için butona tıklayın
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button
                        onClick={handleEnrich}
                        disabled={enriching}
                        size="lg"
                        className="w-60"
                    >
                        {enriching ? 'İşleniyor...' : 'Zenginleştirmeyi Başlat'}
                    </Button>

                    {/* Progress Bar */}
                    {enriching && enrichmentProgress.total > 0 && (
                        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">İlerleme Durumu</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {enrichmentProgress.processed} / {enrichmentProgress.total}
                                    <span className="text-gray-500 dark:text-gray-400 ml-1 font-normal">
                                        ({Math.round((enrichmentProgress.processed / enrichmentProgress.total) * 100)}%)
                                    </span>
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-4 overflow-hidden shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-full transition-all duration-500 ease-out shadow-sm"
                                    style={{
                                        width: `${Math.min((enrichmentProgress.processed / enrichmentProgress.total) * 100, 100)}%`
                                    }}
                                />
                            </div>

                            {/* İstatistikler */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-md">
                                    <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Başarılı:</span>
                                    <span className="text-sm font-bold text-green-600 dark:text-green-500">{enrichmentProgress.success}</span>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-md">
                                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Başarısız:</span>
                                    <span className="text-sm font-bold text-red-600 dark:text-red-500">{enrichmentProgress.failed}</span>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-md">
                                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Telefon:</span>
                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-500">{enrichmentProgress.totalPhones}</span>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-md">
                                    <div className="w-3 h-3 rounded-full bg-purple-500 shadow-sm"></div>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Email:</span>
                                    <span className="text-sm font-bold text-purple-600 dark:text-purple-500">{enrichmentProgress.totalEmails}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Lead Listesi */}
            <Card>
                <CardHeader>
                    <CardTitle>Lead Listesi</CardTitle>
                    <CardDescription>
                        Son 100 lead gösteriliyor
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Şirket</TableHead>
                                <TableHead>Website</TableHead>
                                <TableHead>Website Telefonları</TableHead>
                                <TableHead>Website Mailleri</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead>İşlem</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {leads.map((lead) => (
                                <TableRow key={lead.id}>
                                    <TableCell className="font-medium">
                                        {lead.company ? (lead.company.length > 30 ? lead.company.substring(0, 30) + '...' : lead.company) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {lead.website ? (
                                            <a
                                                href={lead.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline text-sm"
                                            >
                                                {lead.website.length > 40 ? lead.website.substring(0, 40) + '...' : lead.website}
                                            </a>
                                        ) : (
                                            '-'
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {lead.websitePhones ? (
                                            <div className="flex flex-col gap-0.5">
                                                {lead.websitePhones.split(', ').map((phone, idx) => (
                                                    <span key={idx} className="text-xs text-muted-foreground">
                                                        {phone.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {lead.websiteEmails ? (
                                            <div className="flex flex-col gap-0.5">
                                                {lead.websiteEmails.split(', ').map((email, idx) => (
                                                    <span key={idx} className="text-xs text-muted-foreground">
                                                        {email.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getEnrichmentVariant(lead.enrichment_status, lead.is_enriched)}>
                                            {getEnrichmentText(lead.enrichment_status, lead.is_enriched)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <LeadEnrichButton
                                            lead={lead}
                                            onComplete={() => {
                                                fetchLeads()
                                                fetchStats()
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {leads.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                        Lead bulunamadı
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

function getEnrichmentVariant(status, isEnriched) {
    if (isEnriched || status === 'success') {
        return 'default'
    }
    if (status === 'failed') {
        return 'destructive'
    }
    return 'outline'
}

function getEnrichmentText(status, isEnriched) {
    if (isEnriched || status === 'success') {
        return 'Başarılı'
    }
    if (status === 'failed') {
        return 'Başarısız'
    }
    return 'Beklemede'
}

// Tek bir lead için zenginleştirme butonu
function LeadEnrichButton({ lead, onComplete }) {
    const [enriching, setEnriching] = useState(false)
    const [logs, setLogs] = useState([])
    const [showLogs, setShowLogs] = useState(false)

    async function handleSingleEnrich() {
        try {
            setEnriching(true)
            setLogs([])
            setShowLogs(true)

            const response = await fetch('/enrich/api/single', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ lead_id: lead.id })
            })

            const result = await response.json()

            if (result.logs) {
                setLogs(result.logs)
            }

            if (!response.ok) {
                throw new Error(result.error || 'Enrichment başarısız')
            }

            alert(
                `İşlem tamamlandı!\n` +
                `Süre: ${result.duration}ms\n` +
                `Bulunan Telefon: ${result.phonesFound || 0}\n` +
                `Bulunan Email: ${result.emailsFound || 0}\n` +
                `Eklenen Telefon: ${result.phonesInserted || 0}\n` +
                `Eklenen Email: ${result.emailsInserted || 0}\n` +
                `Mod: ${result.fetchMode || 'N/A'}`
            )

            if (onComplete) {
                onComplete()
            }
        } catch (err) {
            alert(`Hata: ${err.message}`)
            if (err.message.includes('logs')) {
                setLogs([`Hata: ${err.message}`])
            }
        } finally {
            setEnriching(false)
        }
    }

    return (
        <div className="flex flex-col gap-1">
            <Button
                onClick={handleSingleEnrich}
                disabled={enriching}
                size="sm"
                variant="outline"
            >
                {enriching ? 'İşleniyor...' : 'Zenginleştir'}
            </Button>
            {showLogs && logs.length > 0 && (
                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs max-h-40 overflow-y-auto">
                    <div className="font-semibold mb-1">Loglar:</div>
                    {logs.map((log, idx) => (
                        <div key={idx} className="text-xs font-mono whitespace-pre-wrap break-words">
                            {log}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

