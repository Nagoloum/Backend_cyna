import { Module } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Contact, ContactSchema } from './entities/contact.entity';
import { UsersModule } from '../users/users.module';
import { JwtService } from '@nestjs/jwt';
import { SendEmailService } from '../../shared/services/sendemail.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Contact.name, schema: ContactSchema }]),
    UsersModule,
  ],
  controllers: [ContactController],
  providers: [ContactService, JwtService, SendEmailService],
})
export class ContactModule {}
