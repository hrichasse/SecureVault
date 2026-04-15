const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3000'

const tests = [
  { name: 'Health', method: 'GET', path: '/api/health', expect: [200] },
  {
    name: 'Classification valid',
    method: 'POST',
    path: '/api/classification',
    body: {
      filename: 'contrato-confidencial.pdf',
      description: 'contiene datos sensibles y confidenciales',
    },
    expect: [200],
  },
  {
    name: 'Classification invalid',
    method: 'POST',
    path: '/api/classification',
    body: {},
    expect: [400],
  },
  {
    name: 'Auth login invalid payload',
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'bad', password: 'short' },
    expect: [400],
  },
  {
    name: 'Auth register invalid payload',
    method: 'POST',
    path: '/api/auth/register',
    body: { email: 'bad' },
    expect: [400],
  },
  { name: 'Auth me no session', method: 'GET', path: '/api/auth/me', expect: [401] },
  { name: 'Auth logout', method: 'POST', path: '/api/auth/logout', expect: [200] },
  { name: 'Documents list no session', method: 'GET', path: '/api/documents', expect: [401] },
  {
    name: 'Documents create no session',
    method: 'POST',
    path: '/api/documents',
    form: true,
    expect: [401],
  },
  {
    name: 'Document detail no session',
    method: 'GET',
    path: '/api/documents/test-document-id',
    expect: [401],
  },
  {
    name: 'Document patch no session',
    method: 'PATCH',
    path: '/api/documents/test-document-id',
    body: { description: 'updated' },
    expect: [401],
  },
  {
    name: 'Document delete no session',
    method: 'DELETE',
    path: '/api/documents/test-document-id',
    expect: [401],
  },
  {
    name: 'Document download no session',
    method: 'GET',
    path: '/api/documents/test-document-id/download',
    expect: [401],
    redirect: 'manual',
  },
  {
    name: 'Access requests list no session',
    method: 'GET',
    path: '/api/access-requests',
    expect: [401],
  },
  {
    name: 'Access requests create no session',
    method: 'POST',
    path: '/api/access-requests',
    body: {
      documentId: 'doc_1',
      reason: 'Necesito revisar este documento por motivos de auditoria',
    },
    expect: [401],
  },
  {
    name: 'Access request patch no session',
    method: 'PATCH',
    path: '/api/access-requests/request_1',
    body: { action: 'reject', reviewNote: 'No corresponde' },
    expect: [401],
  },
  { name: 'Incidents list no session', method: 'GET', path: '/api/incidents', expect: [401] },
  {
    name: 'Incidents create no session',
    method: 'POST',
    path: '/api/incidents',
    body: {
      title: 'Acceso denegado',
      description: 'No se pudo acceder al documento solicitado',
      type: 'ACCESS_DENIED',
    },
    expect: [401],
  },
  {
    name: 'Incident detail no session',
    method: 'GET',
    path: '/api/incidents/incident_1',
    expect: [401],
  },
  {
    name: 'Incident patch no session',
    method: 'PATCH',
    path: '/api/incidents/incident_1',
    body: { status: 'IN_PROGRESS' },
    expect: [401],
  },
  {
    name: 'Certifications list no session',
    method: 'GET',
    path: '/api/certifications',
    expect: [401],
  },
  {
    name: 'Certifications create no session',
    method: 'POST',
    path: '/api/certifications',
    body: { documentId: 'doc_1' },
    expect: [401],
  },
  {
    name: 'Certification verify invalid public',
    method: 'GET',
    path: '/api/certifications/verify/invalid-code-for-smoke-test',
    expect: [404],
  },
  { name: 'Audit list no session', method: 'GET', path: '/api/audit?limit=5', expect: [401] },
  { name: 'Audit export no session', method: 'GET', path: '/api/audit/export', expect: [401] },
  { name: 'Admin users no session', method: 'GET', path: '/api/admin/users', expect: [401] },
  { name: 'Permissions no session', method: 'GET', path: '/api/permissions', expect: [401] },
]

async function runTest(test) {
  const options = {
    method: test.method,
    redirect: test.redirect ?? 'follow',
    headers: {},
  }

  if (test.body) {
    options.headers['content-type'] = 'application/json'
    options.body = JSON.stringify(test.body)
  }

  if (test.form) {
    const formData = new FormData()
    formData.append('description', 'smoke test')
    options.body = formData
  }

  const started = Date.now()

  try {
    const response = await fetch(baseUrl + test.path, options)
    const sample = await getSample(response)

    return {
      test: test.name,
      method: test.method,
      path: test.path,
      status: response.status,
      ok: test.expect.includes(response.status),
      ms: Date.now() - started,
      sample,
    }
  } catch (error) {
    return {
      test: test.name,
      method: test.method,
      path: test.path,
      status: 'ERR',
      ok: false,
      ms: Date.now() - started,
      sample: error instanceof Error ? error.message : String(error),
    }
  }
}

async function getSample(response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const json = await response.json()
    return JSON.stringify(json).slice(0, 160)
  }

  const text = await response.text()
  return text.replace(/\s+/g, ' ').slice(0, 160)
}

const rows = []

for (const test of tests) {
  rows.push(await runTest(test))
}

console.log(`Endpoint smoke tests against ${baseUrl}`)
console.table(
  rows.map(({ test, method, path, status, ok, ms }) => ({
    test,
    method,
    path,
    status,
    ok,
    ms,
  }))
)

const failed = rows.filter((row) => !row.ok)

if (failed.length > 0) {
  console.log('\nFailures:')
  for (const failure of failed) {
    console.log(`${failure.method} ${failure.path} -> ${failure.status}: ${failure.sample}`)
  }
  process.exitCode = 1
} else {
  console.log('\nAll endpoint smoke tests returned expected statuses.')
}
