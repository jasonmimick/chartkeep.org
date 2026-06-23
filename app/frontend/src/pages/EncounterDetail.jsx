import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft } from 'lucide-react'

export default function EncounterDetail() {
  const { folder } = useParams()
  const [enc, setEnc] = useState(null)

  useEffect(() => {
    fetch(`/api/encounters/${folder}`).then(r => r.json()).then(setEnc)
  }, [folder])

  if (!enc) return (
    <div className="flex items-center gap-3 text-muted-foreground text-base mt-16">
      <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
      Loading visit record...
    </div>
  )

  return (
    <div className="max-w-2xl">
      <Link to="/encounters"
        className="inline-flex items-center gap-2 text-muted-foreground text-base hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Visits
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">{enc.meta?.provider}</h1>
        <div className="flex items-center gap-3 text-muted-foreground text-base">
          <span>{enc.meta?.date}</span>
          {enc.meta?.org && <><span>·</span><span>{enc.meta.org}</span></>}
        </div>
      </div>

      <Separator className="mb-8" />

      <Card className="border-border shadow-none">
        <CardContent className="p-7">
          <div className="
            text-base text-foreground leading-relaxed
            [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-widest
            [&_h2]:text-muted-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:first:mt-0
            [&_ul]:space-y-2
            [&_li]:text-foreground [&_li]:text-base [&_li]:list-none [&_li]:pl-0
            [&_li]:before:content-['–'] [&_li]:before:text-muted-foreground [&_li]:before:mr-3
            [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4
            [&_blockquote]:text-muted-foreground [&_blockquote]:not-italic [&_blockquote]:my-3
            [&_p]:text-muted-foreground [&_p]:text-sm [&_p]:italic [&_p]:mt-4
            [&_hr]:border-border [&_hr]:my-6
          ">
            <ReactMarkdown>{enc.body}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
