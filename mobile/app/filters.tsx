import { RequireUser } from '@/features/session/session-provider';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useCards, useCategories } from '@/data/hooks';
import { useDismiss } from '@/features/navigation';
import { useViewState } from '@/features/view-state/view-state';
import { Button, Card, Divider, Screen } from '@/ui/controls';
import { Text } from '@/ui/Text';
import { MIN_TOUCH, space } from '@/ui/tokens';

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{ minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Text accessible={false}>{label}</Text>
      <Text tone="accent" accessible={false}>
        {selected ? '✓' : ''}
      </Text>
    </Pressable>
  );
}

/** Folha de filtros das Despesas (6.7): Forma e Categoria; so valem ao tocar em "Aplicar". */
function FiltersContent() {
  const { finances, patchFinances } = useViewState();
  const dismiss = useDismiss();
  const cards = useCards();
  const categories = useCategories();
  const [cardId, setCardId] = useState<string | null>(finances.cardId);
  const [category, setCategory] = useState<string | null>(finances.category);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          title="Limpar"
          kind="tertiary"
          fullWidth={false}
          onPress={() => {
            setCardId(null);
            setCategory(null);
          }}
        />
        <Text variant="headline" accessibilityRole="header">
          Filtros
        </Text>
        <Button
          title="Aplicar"
          kind="tertiary"
          fullWidth={false}
          onPress={() => {
            patchFinances({ cardId, category });
            dismiss();
          }}
        />
      </View>
      <View style={{ gap: space.xs }}>
        <Text variant="footnote" tone="muted" style={{ textTransform: 'uppercase' }}>
          Forma
        </Text>
        <Card>
          <Option label="Todas" selected={cardId === null} onPress={() => setCardId(null)} />
          <Divider />
          <Option label="PIX" selected={cardId === 'pix'} onPress={() => setCardId('pix')} />
          {cards.isError ? (
            <>
              <Text tone="danger">Não foi possível carregar os cartões.</Text>
              <Button title="Tentar novamente" kind="secondary" fullWidth={false} onPress={() => void cards.refetch()} />
            </>
          ) : (
            (cards.data ?? []).map((card) => (
              <View key={card.id}>
                <Divider />
                <Option label={card.name} selected={cardId === card.id} onPress={() => setCardId(card.id)} />
              </View>
            ))
          )}
        </Card>
      </View>
      <View style={{ gap: space.xs }}>
        <Text variant="footnote" tone="muted" style={{ textTransform: 'uppercase' }}>
          Categoria
        </Text>
        <Card>
          <Option label="Todas" selected={category === null} onPress={() => setCategory(null)} />
          {categories.isError ? (
            <>
              <Text tone="danger">Não foi possível carregar as categorias.</Text>
              <Button title="Tentar novamente" kind="secondary" fullWidth={false} onPress={() => void categories.refetch()} />
            </>
          ) : (
            (categories.data ?? []).map((name) => (
              <View key={name}>
                <Divider />
                <Option label={name} selected={category === name} onPress={() => setCategory(name)} />
              </View>
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
}

export default function Filters() {
  return (
    <RequireUser>
      <FiltersContent />
    </RequireUser>
  );
}
