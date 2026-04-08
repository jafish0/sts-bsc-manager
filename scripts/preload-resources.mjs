/**
 * Pre-load resources from extracted zip files into Supabase.
 *
 * Usage:
 *   node scripts/preload-resources.mjs <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Requires: npm install @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = 'https://jhnquklmwoubpbbmnrjf.supabase.co'
const SERVICE_ROLE_KEY = process.argv[2]

if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node scripts/preload-resources.mjs <SUPABASE_SERVICE_ROLE_KEY>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const BASE = path.resolve('_temp_extract')

// Domain mapping
const DOMAINS = {
  domain1: { path: 'Domain 1- Resilience Building', domain: 'resilience' },
  domain2: { path: 'Domain 2- Promoting Safety', domain: 'safety' },
  domain3: { path: 'Domain 3- STS Informed Organizational Policy', domain: 'policies' },
  domain4: { path: 'Domain 4- STS Leadership Practices', domain: 'leadership' },
  domain5: { path: 'Domain 5- STS Informed Organizational Practices', domain: 'routine' },
  domain6: { path: 'Domain 6- Evaluation and Monitoring', domain: 'evaluation' },
}

// YouTube resources from HTML files
const YOUTUBE_RESOURCES = [
  { domain: 'resilience', title: 'Podcast - Moral Distress', description: 'Well@Work podcast on the topic of Moral Distress', youtube_url: 'https://youtu.be/RRYoIXbfb3I' },
  { domain: 'resilience', title: 'Podcast - Secondary Traumatic Stress', description: 'Well@Work podcast on the topic of Secondary Traumatic Stress', youtube_url: 'https://youtu.be/JjqBKCHOVB0' },
  { domain: 'resilience', title: 'Resilience Buddies Podcast', description: 'Well@Work podcast on Using Accountability Partners to Build Resilience at Work', youtube_url: 'https://youtu.be/_7K4WMBbtQw' },
  { domain: 'safety', title: 'Low Impact Processing (Video)', description: 'Video demonstration of Low Impact Processing technique', youtube_url: 'https://youtu.be/BmI6mfj_Srg' },
  { domain: 'leadership', title: 'Podcast - How Supervisors Can Help Combat STS', description: 'Well@Work podcast on how supervisors can combat secondary traumatic stress', youtube_url: 'https://youtu.be/T176-2R11ZU' },
  { domain: 'leadership', title: 'Low Impact Processing (Video)', description: 'Video demonstration of Low Impact Processing technique', youtube_url: 'https://youtu.be/BmI6mfj_Srg' },
  { domain: 'routine', title: 'Podcast - Accountability Partnerships', description: 'Well@Work podcast on Using Accountability Partners to Build Resilience at Work', youtube_url: 'https://youtu.be/_7K4WMBbtQw' },
]

// External link resources from HTML files
const LINK_RESOURCES = [
  { domain: 'leadership', title: 'Supervisory Tips for Keeping Remote Employees Engaged', description: 'Tips and tools for motivating remote staff to stay engaged and productive', link_url: 'https://www.hr.pitt.edu/news/covid-19-pandemic-supervisor-tips-tools-motivating-remote-staff-stay-engaged-and-productive' },
  { domain: 'evaluation', title: 'Well@Work Self-Monitoring Screeners (Landing Page)', description: 'Free, online, confidential self-monitoring resources — all 4 screeners', link_url: 'https://ctac.uky.edu/projects-and-programs/wellwork/tier-3' },
  { domain: 'evaluation', title: 'Self-Monitoring: Secondary Traumatic Stress Screener', description: 'Free confidential STS screening tool with linked resources', link_url: 'https://uky.az1.qualtrics.com/jfe/form/SV_74kaJ4rMT1yDFVI' },
  { domain: 'evaluation', title: 'Self-Monitoring: Burnout Screener', description: 'Free confidential burnout screening tool with linked resources', link_url: 'https://uky.az1.qualtrics.com/jfe/form/SV_2fOtv0U2rZBAxGC' },
  { domain: 'evaluation', title: 'Self-Monitoring: Moral Distress Screener', description: 'Free confidential moral distress screening tool with linked resources', link_url: 'https://uky.az1.qualtrics.com/jfe/form/SV_3aPtP8JSCK6sPFI' },
  { domain: 'evaluation', title: 'Self-Monitoring: General Perceived Stress Screener', description: 'Free confidential general stress screening tool with linked resources', link_url: 'https://uky.az1.qualtrics.com/jfe/form/SV_b0ZGax5PeYXqG0u' },
]

// Files to skip (HTML files handled above, mp4 replaced with YouTube)
const SKIP_EXTENSIONS = ['.html', '.mp4']

function getResourceType(filename) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx') return 'docx'
  if (ext === '.doc') return 'doc'
  if (ext === '.pptx') return 'pptx'
  return null
}

function cleanTitle(filename) {
  return filename
    .replace(/\.[^/.]+$/, '')  // remove extension
    .replace(/[_]/g, ' ')     // underscores to spaces
    .trim()
}

async function uploadFile(filePath, storagePath) {
  const fileBuffer = fs.readFileSync(filePath)
  const { error } = await supabase.storage
    .from('resources')
    .upload(storagePath, fileBuffer, {
      contentType: getMimeType(filePath),
      upsert: false
    })
  if (error) {
    if (error.message?.includes('already exists')) {
      console.log(`  [skip] Already exists: ${storagePath}`)
      return storagePath
    }
    throw error
  }
  return storagePath
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const types = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  return types[ext] || 'application/octet-stream'
}

async function main() {
  let totalUploaded = 0
  let totalInserted = 0

  // 1. Upload files and insert DB rows for each domain
  for (const [dirKey, config] of Object.entries(DOMAINS)) {
    const domainDir = path.join(BASE, dirKey, config.path)
    if (!fs.existsSync(domainDir)) {
      console.log(`[warn] Directory not found: ${domainDir}`)
      continue
    }

    const files = fs.readdirSync(domainDir)
    console.log(`\n=== ${config.path} (${config.domain}) — ${files.length} files ===`)

    for (const filename of files) {
      const ext = path.extname(filename).toLowerCase()
      if (SKIP_EXTENSIONS.includes(ext)) {
        console.log(`  [skip] ${filename}`)
        continue
      }

      const resourceType = getResourceType(filename)
      if (!resourceType) {
        console.log(`  [skip] Unknown type: ${filename}`)
        continue
      }

      const filePath = path.join(domainDir, filename)
      const uniqueName = `${crypto.randomUUID()}${ext}`
      const storagePath = `resources/${uniqueName}`

      try {
        console.log(`  Uploading: ${filename}`)
        await uploadFile(filePath, storagePath)
        totalUploaded++

        const { error } = await supabase.from('resources').insert({
          title: cleanTitle(filename),
          domains: [config.domain],
          resource_type: resourceType,
          file_path: storagePath,
          file_name: filename,
        })
        if (error) throw error
        totalInserted++
        console.log(`  [ok] ${filename} → ${resourceType}`)
      } catch (err) {
        console.error(`  [ERROR] ${filename}: ${err.message}`)
      }
    }
  }

  // 2. Insert YouTube resources
  console.log(`\n=== YouTube Resources (${YOUTUBE_RESOURCES.length}) ===`)
  for (const yt of YOUTUBE_RESOURCES) {
    try {
      const { error } = await supabase.from('resources').insert({
        title: yt.title,
        description: yt.description,
        domains: [yt.domain],
        resource_type: 'youtube',
        youtube_url: yt.youtube_url,
      })
      if (error) throw error
      totalInserted++
      console.log(`  [ok] ${yt.title} (${yt.domain})`)
    } catch (err) {
      console.error(`  [ERROR] ${yt.title}: ${err.message}`)
    }
  }

  // 3. Insert link resources
  console.log(`\n=== Link Resources (${LINK_RESOURCES.length}) ===`)
  for (const link of LINK_RESOURCES) {
    try {
      const { error } = await supabase.from('resources').insert({
        title: link.title,
        description: link.description,
        domains: [link.domain],
        resource_type: 'link',
        link_url: link.link_url,
      })
      if (error) throw error
      totalInserted++
      console.log(`  [ok] ${link.title} (${link.domain})`)
    } catch (err) {
      console.error(`  [ERROR] ${link.title}: ${err.message}`)
    }
  }

  console.log(`\n=== DONE ===`)
  console.log(`Files uploaded: ${totalUploaded}`)
  console.log(`DB rows inserted: ${totalInserted}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
