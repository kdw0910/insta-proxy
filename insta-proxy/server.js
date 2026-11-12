const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');

const app = express();

app.use('/', createProxyMiddleware({
    target: 'https://www.instagram.com',
    changeOrigin: true,
    selfHandleResponse: true, // 응답 헤더 및 바디 수정을 위해 필수
    
    // 1. 요청 보낼 때: 인스타 서버가 차단하지 않도록 정상 브라우저처럼 위장
    on: {
        proxyReq: (proxyReq, req, res) => {
            proxyReq.setHeader('Referer', 'https://www.instagram.com/');
            proxyReq.setHeader('Origin', 'https://www.instagram.com');
            // Gzip 압축이 풀려야 분석이 원활하도록 인코딩 조절
            proxyReq.setHeader('Accept-Encoding', 'identity');
        },

        // 2. 응답 받을 때: 릴스/화면 차단 유발하는 보안 헤더(CSP, Frame) 강제 삭제
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
            // 브라우저 렌더링 차단 헤더 제거
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
            delete proxyRes.headers['cross-origin-resource-policy'];

            // 쿠키 도메인을 내 프록시 도메인으로 허용
            if (proxyRes.headers['set-cookie']) {
                proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => 
                    cookie.replace(/Domain=\.?instagram\.com/gi, '')
                );
            }

            return responseBuffer;
        })
    }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bypass Proxy is running on port ${PORT}`);
});