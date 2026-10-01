'use client'

import { useState } from 'react'
import { useFeatureState } from '@/lib/hooks/use-feature-state'
import { MessageSquare, Bug, Send, Loader2, CheckCircle2, ChevronDown, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'feedback' | 'bug'

const CATEGORIES = [
  { value: 'general', label: 'General feedback' },
  { value: 'feature', label: 'Feature request'  },
  { value: 'other',   label: 'Other'             },
]

function SuccessState({ title, body, onReset, resetLabel }: {
  title: string; body: string; onReset: () => void; resetLabel: string
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30 border border-green-800/50">
        <CheckCircle2 className="h-8 w-8 text-green-400" />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-gray-400">{body}</p>
      </div>
      <button onClick={onReset} className="mt-1 text-sm font-medium text-brand-400 hover:underline">
        {resetLabel}
      </button>
    </div>
  )
}

export default function FeedbackPage() {
  const [feedbackForm, setFeedbackForm] = useFeatureState('feedback-form', {
    tab:         'feedback' as Tab,
    category:    'general',
    message:     '',
    title:       '',
    description: '',
    steps:       '',
  })
  const { tab, category, message, title, description, steps } = feedbackForm
  const setTab = (v: Tab) => setFeedbackForm({ tab: v })

  const [fbLoading, setFbLoading] = useState(false)
  const [fbDone,    setFbDone]    = useState(false)
  const [fbError,   setFbError]   = useState('')
  const [bgLoading, setBgLoading] = useState(false)
  const [bgDone,    setBgDone]    = useState(false)
  const [bgError,   setBgError]   = useState('')

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault()
    setFbError('')
    setFbLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ category, message }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to submit')
      setFbDone(true)
      setFeedbackForm({ message: '' })
    } catch (err) {
      setFbError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setFbLoading(false)
    }
  }

  async function submitBug(e: React.FormEvent) {
    e.preventDefault()
    setBgError('')
    setBgLoading(true)
    try {
      const res = await fetch('/api/bug-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, description, steps: steps || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to submit')
      setBgDone(true)
      setFeedbackForm({ title: '', description: '', steps: '' })
    } catch (err) {
      setBgError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBgLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Feedback &amp; Support</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Help us improve Architect Pay — we read every submission.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-gray-700/60 bg-gray-900/60 p-1">
        <button
          onClick={() => { setTab('feedback'); setFbDone(false) }}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
            tab === 'feedback' ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300',
          )}
        >
          <Sparkles className="h-4 w-4" /> Send Feedback
        </button>
        <button
          onClick={() => { setTab('bug'); setBgDone(false) }}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
            tab === 'bug' ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-300',
          )}
        >
          <Bug className="h-4 w-4" /> Report a Bug
        </button>
      </div>

      {/* Feedback form */}
      {tab === 'feedback' && (
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 p-6">
          {fbDone ? (
            <SuccessState
              title="Thanks for your feedback!"
              body="We read every submission and use it to make Architect Pay better."
              onReset={() => setFbDone(false)}
              resetLabel="Send another"
            />
          ) : (
            <form onSubmit={submitFeedback} className="space-y-4">
              {fbError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{fbError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Category</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setFeedbackForm({ category: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-gray-700 bg-gray-800 py-2.5 pl-4 pr-10 text-sm text-white outline-none focus:border-brand-500/50"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Your feedback</label>
                  <span className="text-xs text-gray-600">{message.length}/2000</span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setFeedbackForm({ message: e.target.value })}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-brand-500/50 min-h-[140px] resize-y"
                  placeholder="Tell us what you think, what you'd like to see, or anything on your mind…"
                  maxLength={2000}
                  required
                  minLength={10}
                />
              </div>

              <button
                type="submit"
                disabled={fbLoading || message.length < 10}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {fbLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {fbLoading ? 'Sending…' : 'Send Feedback'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Bug report form */}
      {tab === 'bug' && (
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 p-6">
          {bgDone ? (
            <SuccessState
              title="Bug report received!"
              body="We'll investigate and fix it as soon as possible."
              onReset={() => setBgDone(false)}
              resetLabel="Report another"
            />
          ) : (
            <form onSubmit={submitBug} className="space-y-4">
              {bgError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{bgError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">What went wrong?</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setFeedbackForm({ title: e.target.value })}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-brand-500/50"
                  placeholder='e.g. "Payment stuck on Processing"'
                  maxLength={150}
                  required
                  minLength={3}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Describe the issue</label>
                  <span className="text-xs text-gray-600">{description.length}/3000</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setFeedbackForm({ description: e.target.value })}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-brand-500/50 min-h-[120px] resize-y"
                  placeholder="What were you doing when it happened? What did you expect?"
                  maxLength={3000}
                  required
                  minLength={10}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Steps to reproduce <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <textarea
                  value={steps}
                  onChange={(e) => setFeedbackForm({ steps: e.target.value })}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-brand-500/50 min-h-[90px] resize-y"
                  placeholder={'1. Go to Send Payment\n2. Enter amount\n3. Click Send\n4. …'}
                  maxLength={2000}
                />
              </div>

              <button
                type="submit"
                disabled={bgLoading || title.length < 3 || description.length < 10}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-navy-950 hover:bg-brand-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
                {bgLoading ? 'Submitting…' : 'Submit Bug Report'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3">
        <MessageSquare className="h-4 w-4 shrink-0 text-gray-600" />
        <p className="text-xs text-gray-600">
          You can also reach us via the community Discord or open a GitHub issue for public bugs.
        </p>
      </div>
    </div>
  )
}
