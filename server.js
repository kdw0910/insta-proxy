const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const app = express();

app.use('/', createProxyMiddleware({
    target: 'https://www.instagram.com',
    changeOrigin: true,
    secure: true,
    autoRewrite: true,       // 301/302 리다이렉트 시 호스트 자동 변환
    followRedirects: false,   // 브라우저가 프록시 주소로 리다이렉트 받도록 설정
    selfHandleResponse: true,

    cookieDomainRewrite: {
        "*": "" // 모든 쿠키의 도메인을 내 프록시 도메인으로 강제 변경
    },
    cookiePathRewrite: {
        "*": "/"
    },

    on: {
        proxyReq: (proxyReq, req, res) => {
            proxyReq.setHeader('Host', 'www.instagram.com');
            proxyReq.setHeader('Origin', 'https://www.instagram.com');
            proxyReq.setHeader('Referer', 'https://www.instagram.com/');
            proxyReq.setHeader('Accept-Encoding', 'identity');
        },

        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
            // 1. [핵심] 로그인 성공 시 인스타가 instagram.com으로 튕겨내는 리다이렉트 가로채기
            if (proxyRes.headers['location']) {
                const myHost = req.headers.host; // 예: insta-proxy-1-hhfh.onrender.com
                proxyRes.headers['location'] = proxyRes.headers['location']
                    .replace(/https?:\/\/(www\.)?instagram\.com/gi, `https://${myHost}`);
            }

            // 2. 보안 헤더 강제 제거
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
            delete proxyRes.headers['cross-origin-resource-policy'];

            // 3. 쿠키 속성 변환
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
                proxyRes.headers['set-cookie'] = (Array.isArray(setCookie) ? setCookie : [setCookie]).map(cookie => {
                    return cookie
                        .replace(/;\s*Domain=[^;]+/gi, '')
                        .replace(/;\s*SameSite=Lax/gi, '; SameSite=None')
                        .replace(/;\s*SameSite=Strict/gi, '; SameSite=None');
                });
            }

            // 4. HTML 내부 하드코딩된 instagram.com 링크를 내 프록시 주소로 치환
            const contentType = proxyRes.headers['content-type'] || '';
            if (contentType.includes('text/html')) {
                let html = responseBuffer.toString('utf8');
                const myHost = req.headers.host;
                html = html.replace(/https:\/\/(www\.)?instagram\.com/gi, `https://${myHost}`);
                return html;
            }

            return responseBuffer;
        })
    }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bypass Proxy running on port ${PORT}`);
});
