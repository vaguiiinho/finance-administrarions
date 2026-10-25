import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { CreateCard } from '../../application/use-cases/cards/create-card.js';
import { ListCards } from '../../application/use-cases/cards/list-cards.js';
import { UpdateCard } from '../../application/use-cases/cards/update-card.js';
import { presentCard } from './presenters/card.presenter.js';
import { cardBodySchema, type CardBody } from './schemas/card.schemas.js';

@Controller('cards')
export class CardsController {
  constructor(
    @Inject(CreateCard) private readonly createCard: CreateCard,
    @Inject(ListCards) private readonly listCards: ListCards,
    @Inject(UpdateCard) private readonly updateCard: UpdateCard,
  ) {}

  @Post()
  async create(@Body(new ZodValidationPipe(cardBodySchema)) body: CardBody) {
    return presentCard(await this.createCard.execute(body));
  }

  @Get()
  async list() {
    const { items } = await this.listCards.execute({});
    return { items: items.map(presentCard) };
  }

  @Put(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(cardBodySchema)) body: CardBody) {
    return presentCard(await this.updateCard.execute({ id, ...body }));
  }
}
