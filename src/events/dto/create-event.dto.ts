export class CreateEventDto {
  title!: string;
  description!: string;
  category!: string;
  date!: string;
  time!: string;
  location!: string;
  venue!: string;
  price!: number;
  capacity!: number;
  image?: string;
  tags?: string[];
  institution!: string;
}
