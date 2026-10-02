import { IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";
import { LeadSource, LeadStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { Type } from "class-transformer";

export class LeadDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() interest?: string;
  @IsOptional() @IsEnum(LeadSource) source?: LeadSource;
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() assignedToId?: string;
}
export class CustomerDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() notes?: string;
}
export class DealDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsInt() @Min(0) amountMinor?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() stage?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsDateString() expectedAt?: string;
}
export class TaskDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
export class UpdateLeadDto extends PartialType(LeadDto) {}
export class UpdateCustomerDto extends PartialType(CustomerDto) {}
export class UpdateDealDto extends PartialType(DealDto) {}
export class UpdateTaskDto extends PartialType(TaskDto) {}
export class TaskCommentDto { @IsString() @MinLength(1) @MaxLength(2000) body!: string; }
export class ConvertLeadDto {
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() dealTitle?: string;
  @IsOptional() @IsInt() @Min(0) dealAmountMinor?: number;
}
export class BulkLeadImportDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LeadDto) leads!: LeadDto[];
}
export class BulkLeadStatusDto {
  @IsArray() @IsString({ each: true }) ids!: string[];
  @IsEnum(LeadStatus) status!: LeadStatus;
}
