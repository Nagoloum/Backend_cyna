import { Injectable } from '@nestjs/common';
import { CreateSliderDto } from './dto/create-slider.dto';
import { UpdateSliderDto } from './dto/update-slider.dto';
import { Slider } from './entities/slider.entity';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class SlidersService {
  constructor(
    @InjectModel(Slider.name) private readonly userModel: Model<Slider>,
  ) { }
  /*
  create(createSliderDto: CreateSliderDto) {
    return 'This action adds a new slider';
  }*/

  findAll() {
    try {

    } catch (error) {
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} slider`;
  }

  update(id: number, updateSliderDto: UpdateSliderDto) {
    return `This action updates a #${id} slider`;
  }

  remove(id: number) {
    return `This action removes a #${id} slider`;
  }
}

