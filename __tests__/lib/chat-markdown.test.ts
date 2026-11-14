import { renderMarkdown } from '@/lib/chat-markdown'

describe('renderMarkdown del asistente', () => {
  it('no deja pasar HTML de la respuesta (XSS)', () => {
    const html = renderMarkdown('Documento: <img src=x onerror="alert(1)"> y <script>alert(2)</script>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  })

  it('sigue formateando negrita, cursiva y listas', () => {
    const html = renderMarkdown('**Contrato** y *borrador*\n- uno\n- dos')
    expect(html).toContain('<strong>Contrato</strong>')
    expect(html).toContain('<em>borrador</em>')
    expect(html).toContain('<li>uno</li>')
    expect(html).toContain('<ul')
  })

  it('el HTML dentro de la negrita también queda escapado', () => {
    expect(renderMarkdown('**<b onmouseover=x>hola</b>**')).toBe(
      '<strong>&lt;b onmouseover=x&gt;hola&lt;/b&gt;</strong>'
    )
  })
})
