import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { LogModule } from './log/log.module';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI_PROXY || 'mongodb://localhost:27017/proxy-logs'), // MongoDB 连接字符串
    LogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}