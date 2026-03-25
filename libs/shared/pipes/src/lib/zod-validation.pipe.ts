import {ArgumentMetadata, BadRequestException, PipeTransform} from "@nestjs/common";
import {ZodSchema} from "zod/v3";


export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try{
      return this.schema.parse(value);
    }
    catch (error) {
      throw new BadRequestException('Validation failed');
    }
  }
}
