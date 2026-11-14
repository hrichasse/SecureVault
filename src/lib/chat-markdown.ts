/**
 * Markdown mínimo para las respuestas del asistente Vault.
 *
 * Las respuestas incluyen nombres, descripciones y texto de PDFs que puede subir
 * cualquier usuario, y se insertan con dangerouslySetInnerHTML. Por eso primero
 * se escapa TODO el texto y recién después se agregan las etiquetas propias
 * (strong, em, ul/li, p, br): ningún HTML de la respuesta llega a ejecutarse.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\n)\*(?!\*)(.*?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/(?:<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul class="list-disc list-inside space-y-1 my-1">${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>')
}
