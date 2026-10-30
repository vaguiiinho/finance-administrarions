import { Global, Module } from '@nestjs/common';
import { BUSINESS_CALENDAR } from './application/ports/business-calendar.js';
import { CLOCK, type Clock } from './application/ports/clock.js';
import { DOMAIN_EVENT_PUBLISHER } from './application/ports/domain-event-publisher.js';
import { ID_GENERATOR } from './application/ports/id-generator.js';
import { InProcessEventPublisher } from './infrastructure/in-process-event-publisher.js';
import { SaoPauloBusinessCalendar } from './infrastructure/sao-paulo-business-calendar.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { UuidV7IdGenerator } from './infrastructure/uuid-v7-id-generator.js';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidV7IdGenerator },
    { provide: DOMAIN_EVENT_PUBLISHER, useClass: InProcessEventPublisher },
    { provide: BUSINESS_CALENDAR, useFactory: (clock: Clock) => new SaoPauloBusinessCalendar(clock), inject: [CLOCK] },
  ],
  exports: [CLOCK, ID_GENERATOR, DOMAIN_EVENT_PUBLISHER, BUSINESS_CALENDAR],
})
export class SharedModule {}
