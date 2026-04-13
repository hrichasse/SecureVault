'use client'

import { useState } from 'react'
import { IncidentForm } from './IncidentForm'

export function ReportIncidentButton({ documentId }: { documentId: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary w-full text-sm justify-center border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/15"
      >
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Reportar Problema
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/80 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-[#e2e8f0] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Reportar Incidente Documental
            </h3>
            
            <p className="text-sm text-[#94a3b8] mb-6">
              Registraremos este incidente asignándole una prioridad automática basada en el nivel de confidencialidad de este documento.
            </p>

            <IncidentForm 
              documentId={documentId} 
              onSuccess={() => setIsOpen(false)} 
              onCancel={() => setIsOpen(false)} 
            />
          </div>
        </div>
      )}
    </>
  )
}
