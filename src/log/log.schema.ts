import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Log extends Document {
  @Prop() provider: string;
  @Prop() url: string;
  @Prop() method: string;
  @Prop({ type: Object }) requestBody: any;
  @Prop({ type: Object }) response: any;
  @Prop({ default: Date.now }) timestamp: Date;
}

export const LogSchema = SchemaFactory.createForClass(Log);