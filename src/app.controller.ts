import { Controller, Post, Body, HttpException, HttpStatus, Res, Req, Get } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { LogService } from './log/log.service';
import { Request, Response } from 'express';
import * as crypto from 'crypto'; // 用于 Hunyuan 签名

@Controller('proxy')
export class AppController {
  constructor(private logService: LogService) {}

  @Post()
  async proxyRequest(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const { provider, model, messages, stream = false, apiKey, secretId, secretKey } = body; // secretId/Key for Hunyuan

    let targetUrl: string;
    let headers: any = { 'Content-Type': 'application/json' };
    let reqBody: any;
    let method = 'POST';

    switch (provider.toLowerCase()) {
      case 'openai':
        targetUrl = `https://api.openai.com/v1/chat/completions`;
        headers['Authorization'] = `Bearer ${apiKey}`;
        reqBody = { model, messages, stream };
        break;
      case 'gemini':
        const endpoint = stream ? 'streamGenerateContent' : 'generateContent';
        targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${apiKey}`;
        reqBody = { contents: messages.map((m: { content: any; role: any; }) => ({ parts: [{ text: m.content }], role: m.role })) };
        break;
      case 'claude':
        targetUrl = `https://api.anthropic.com/v1/messages`;
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        reqBody = { model, messages, stream, max_tokens: 1024 };
        break;
      case 'qwen':
        targetUrl = `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`;
        headers['Authorization'] = `Bearer ${apiKey}`;
        reqBody = { model, messages, stream };
        break;
      case 'hunyuan':
        targetUrl = `https://hunyuan.tencentcloudapi.com/`;
        // Hunyuan 签名认证
        const timestamp = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ Model: model, Messages: messages, Stream: stream });
        const signature = this.generateHunyuanSignature(secretId, secretKey, timestamp, payload);
        headers['Authorization'] = signature;
        headers['X-TC-Action'] = 'ChatCompletions';
        headers['X-TC-Timestamp'] = timestamp.toString();
        headers['X-TC-Version'] = '2023-09-01';
        reqBody = payload;
        break;
      case 'deepseek':
        targetUrl = `https://api.deepseek.com/v1/chat/completions`;
        headers['Authorization'] = `Bearer ${apiKey}`;
        reqBody = { model, messages, stream };
        break;
      case 'ollama':
        targetUrl = `http://localhost:11434/api/chat`;
        reqBody = { model, messages, stream };
        break;
      default:
        throw new HttpException('Unsupported provider', HttpStatus.BAD_REQUEST);
    }

    try {
      const proxy = createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        selfHandleResponse: true,
        on: {
          proxyReq: (proxyReq) => {
            Object.entries(headers).forEach(([key, value]) => proxyReq.setHeader(key, value as string | number | readonly string[]));
            if (reqBody) {
              proxyReq.write(JSON.stringify(reqBody));
              proxyReq.end();
            }
          },
          proxyRes: (proxyRes, req, res) => {
            let responseData = '';
            proxyRes.on('data', (chunk) => {
              responseData += chunk;
              if (stream) res.write(chunk); // 流式输出
            });
            proxyRes.on('end', async () => {
              await this.logService.logRequest({
                provider, url: targetUrl, method, requestBody: reqBody, response: responseData,
              });
              if (stream) res.end();
              else { res.statusCode = proxyRes.statusCode; res.end(responseData); }
            });
          },
          error: (err) => {
            throw new HttpException(err.message, HttpStatus.BAD_GATEWAY);
          },
        },
      });

      proxy(req, res);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  private generateHunyuanSignature(secretId: string, secretKey: string, timestamp: number, payload: string): string {
    // 简化签名逻辑，实际参考腾讯文档
    const stringToSign = `POST\n/\n\n${payload}\n`;
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(stringToSign);
    const signature = hmac.digest('hex');
    return `TC3-HMAC-SHA256 Credential=${secretId}/${new Date().toISOString().split('T')[0]}/hunyuan/tc3_request, SignedHeaders=content-type;host, Signature=${signature}`;
  }

  @Get()
  async getHello(): Promise<string> {
    return 'Hello World!';
  }
}