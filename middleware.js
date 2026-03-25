export const config = {
  matcher: ['/((?!api/|favicon.ico|_next/static|_next/image).*)'],
};

export default function middleware(request) {
  const authorizationHeader = request.headers.get('authorization');

  if (authorizationHeader) {
    const basicAuth = authorizationHeader.split(' ')[1];
    const [user, password] = atob(basicAuth).split(':');

    if (user === 'admin' && password === 'hrbp2026') {
      return new Response(null, {
        headers: { 'x-middleware-next': '1' }
      });
    }
  }

  return new Response('Autenticación requerida', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Acceso Seguro Dashboard HRBP"',
    },
  });
}
