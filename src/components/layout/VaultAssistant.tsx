'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Send, Minimize2, Maximize2, Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_ACTIONS = [
  '¿Cómo subo un documento?',
  '¿Cómo solicito acceso?',
  '¿Cómo reporto un incidente?',
  '¿Qué niveles de confidencialidad existen?',
]

const PAGE_CONTEXT: Record<string, string> = {
  '/dashboard': 'Dashboard principal',
  '/documents': 'Gestión de documentos',
  '/requests': 'Solicitudes de acceso',
  '/incidents': 'Incidentes de seguridad',
  '/certifications': 'Certificaciones',
  '/audit': 'Auditoría del sistema',
  '/admin': 'Administración de usuarios',
  '/settings': 'Configuración',
}

// ─── Markdown renderer ligero ─────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\n)\*(?!\*)(.*?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, (m) => `<ul class="list-disc list-inside space-y-1 my-1">${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>')
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
        <Bot className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Chat message ─────────────────────────────────────────────────────────────

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'gradient-primary text-white rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <p
            className="[&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-0.5 [&_ul]:my-1 [&_li]:leading-snug"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VaultAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy **Vault**, tu asistente de SecureVault AI 🔐\n\n¿En qué puedo ayudarte hoy?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()

  const currentPage = Object.entries(PAGE_CONTEXT).find(([path]) =>
    pathname.startsWith(path)
  )?.[1]

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setHasUnread(false)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen, isMinimized])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsLoading(true)

      try {
        const history = [...messages, userMsg].slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const contextualHistory = currentPage
          ? [
              { role: 'user' as const, content: `[Contexto: el usuario está en la sección "${currentPage}"]` },
              { role: 'assistant' as const, content: 'Entendido, tengo en cuenta esa sección.' },
              ...history,
            ]
          : history

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: contextualHistory }),
        })

        const data = await res.json()
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message ?? data.error ?? 'Lo siento, ocurrió un error.',
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMsg])
        if (!isOpen) setHasUnread(true)
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Hubo un problema de conexión. Por favor intenta nuevamente.',
            timestamp: new Date(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [messages, isLoading, currentPage, isOpen]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleReset = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: 'Conversación reiniciada. ¿En qué puedo ayudarte? 🔐',
        timestamp: new Date(),
      },
    ])
  }

  const handleToggleMinimize = () => {
    setIsMinimized((prev) => !prev)
  }

  return (
    <>
      {/* FAB flotante */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setIsOpen(true)
              setIsMinimized(false)
            }}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full gradient-primary shadow-elevated flex items-center justify-center"
            aria-label="Abrir asistente Vault"
            id="vault-assistant-fab"
          >
            <Bot className="h-6 w-6 text-white" />
            {hasUnread && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-destructive border-2 border-background"
              />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Ventana de chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] rounded-2xl shadow-elevated border border-border bg-card overflow-hidden flex flex-col"
          >
            {/* Header — siempre visible */}
            <div className="gradient-primary px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white">Vault Assistant</span>
                    <Sparkles className="h-3 w-3 text-white/70" />
                  </div>
                  {currentPage && (
                    <span className="text-xs text-white/70">{currentPage}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  title="Reiniciar conversación"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleToggleMinimize}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  title={isMinimized ? 'Expandir' : 'Minimizar'}
                  id="vault-minimize-btn"
                >
                  {isMinimized ? (
                    <Maximize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Minimize2 className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  title="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Cuerpo — colapsa con CSS max-height, sin AnimatePresence para evitar parpadeo */}
            <div
              style={{
                maxHeight: isMinimized ? '0px' : '460px',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease-in-out',
              }}
              className="flex flex-col"
            >
              {/* Mensajes */}
              <div className="overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[320px]">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isLoading && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>

              {/* Acciones rápidas */}
              {messages.length <= 1 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action}
                      onClick={() => sendMessage(action)}
                      className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors text-muted-foreground"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="border-t border-border p-3 flex gap-2 flex-shrink-0">
                <input
                  ref={inputRef}
                  id="vault-assistant-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
                  disabled={isLoading}
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 transition-colors"
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="gradient-primary text-white h-9 w-9 flex-shrink-0"
                  id="vault-assistant-send"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Footer */}
              <div className="px-4 pb-3 text-center">
                <span className="text-[10px] text-muted-foreground">
                  Powered by Gemini AI · SecureVault AI
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
