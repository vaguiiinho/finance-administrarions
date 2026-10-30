import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { CurrentOwnerId } from '@shared/presentation/auth/current-principal.decorators.js';
import { ZodValidationPipe } from '@shared/presentation/pipes/zod-validation.pipe.js';
import { CreateCard } from '../../application/use-cases/cards/create-card.js';
import { UpdateCard } from '../../application/use-cases/cards/update-card.js';
import { FinanceReadHandlers } from './finance-read-handlers.js';
import { presentCard } from './presenters/card.presenter.js';
import { cardBodySchema, type CardBody } from './schemas/card.schemas.js';

@Controller('cards')
export class CardsController {
  constructor(
    @Inject(CreateCard) private readonly createCard: CreateCard,
    @Inject(UpdateCard) private readonly updateCard: UpdateCard,
    @Inject(FinanceReadHandlers) private readonly reads: FinanceReadHandlers,
  ) {}

  @Post()
  async create(@CurrentOwnerId() ownerId: string, @Body(new ZodValidationPipe(cardBodySchema)) body: CardBody) {
    return presentCard(await this.createCard.execute({ ownerId, ...body }));
  }

  @Get()
  list(@CurrentOwnerId() ownerId: string) {
    return this.reads.cards(ownerId);
  }

  @Put(':id')
  @HttpCode(200)
  async update(
    @CurrentOwnerId() ownerId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cardBodySchema)) body: CardBody,
  ) {
    return presentCard(await this.updateCard.execute({ ownerId, id, ...body }));
  }
}
