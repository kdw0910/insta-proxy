const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const app = express();

app.use('/', createProxyMiddleware({
    target: 'https://www.instagram.com',
    changeOrigin: true,
    secure: true,
    selfHandleResponse: true,
    
    // 쿠키 도메인 및 경로를 내 프록시 도메인으로 자동 리라이트
    cookieDomainRewrite: {
        "instagram.com": "",
        ".instagram.com": "",
        "*": ""
    },
    cookiePathRewrite: {
        "*": "/"
    },

    on: {
        // 1. 브라우저 -> 인스타그램으로 요청 보낼 때
        proxyReq: (proxyReq, req, res) => {
            // 인스타그램이 의심하지 않도록 필수 헤더 조작
            proxyReq.setHeader('Host', 'www.instagram.com');
            proxyReq.setHeader('Origin', 'https://www.instagram.com');
            proxyReq.setHeader('Referer', 'https://www.instagram.com/');
            proxyReq.setHeader('Accept-Encoding', 'identity'); // 압축 해제
        },

        // 2. 인스타그램 -> 브라우저로 응답 내려줄 때
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
            // 브라우저 화면 차단 및 보안 헤더 제거
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
            delete proxyRes.headers['cross-origin-resource-policy'];

            // Set-Cookie 헤더에서 instagram.com 도메인 강제 제거 (내 도메인에 쿠키가 구워지도록)
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
                proxyRes.headers['set-cookie'] = (Array.isArray(setCookie) ? setCookie : [setCookie]).map(cookie => {
                    return cookie
                        .replace(/;\s*Domain=[^;]+/gi, '') // Domain 강제 삭제
                        .replace(/;\s*SameSite=Lax/gi, '; SameSite=None') // 크로스사이트 허용
                        .replace(/;\s*SameSite=Strict/gi, '; SameSite=None');
                });
            }

            return responseBuffer;
        })
    }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bypass Proxy is running on port ${PORT}`);
});
