import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchableSelect from '../SearchableSelect';

function makeOptions(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    value: `id-${i}`,
    label: `Klant ${i.toString().padStart(2, '0')}`,
  }));
}

describe('SearchableSelect', () => {
  it('toont placeholder wanneer er geen waarde gekozen is', () => {
    render(
      <SearchableSelect
        value=""
        onChange={() => {}}
        options={makeOptions(3)}
        placeholder="Kies klant…"
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Kies klant…');
  });

  it('toont selected label op de trigger', () => {
    render(
      <SearchableSelect
        value="id-2"
        onChange={() => {}}
        options={makeOptions(5)}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Klant 02');
  });

  it('opent de listbox bij klik en sluit weer bij Escape', async () => {
    const user = userEvent.setup();
    render(<SearchableSelect value="" onChange={() => {}} options={makeOptions(8)} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Verstuur Escape op de zoekinput (die heeft de focus na openen).
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('toont automatisch de zoekbalk bij ≥6 opties en filtert', async () => {
    const user = userEvent.setup();
    render(<SearchableSelect value="" onChange={() => {}} options={makeOptions(10)} searchPlaceholder="Zoek klant…" />);

    await user.click(screen.getByRole('combobox'));
    const search = screen.getByPlaceholderText('Zoek klant…');
    expect(search).toBeInTheDocument();

    await user.type(search, '07');
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(1);
    expect(opts[0]).toHaveTextContent('Klant 07');
  });

  it('verbergt search bij lijst < 6 opties (default-drempel)', async () => {
    const user = userEvent.setup();
    render(<SearchableSelect value="" onChange={() => {}} options={makeOptions(4)} searchPlaceholder="ZOEK" />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.queryByPlaceholderText('ZOEK')).toBeNull();
  });

  it('emitteert onChange met de gekozen value en sluit de lijst', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchableSelect value="" onChange={onChange} options={makeOptions(8)} />);

    await user.click(screen.getByRole('combobox'));
    // Kies de derde optie via klik.
    await user.click(screen.getByText('Klant 03'));

    expect(onChange).toHaveBeenCalledWith('id-3');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('toont de empty-optie wanneer emptyOptionLabel is opgegeven en kiest "" op klik', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value="id-1"
        onChange={onChange}
        options={makeOptions(8)}
        emptyOptionLabel="Geen specifieke klant"
      />,
    );
    await user.click(screen.getByRole('combobox'));
    const emptyRow = screen.getByText('Geen specifieke klant');
    await user.click(emptyRow);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('keyboard navigation: ArrowDown + Enter selecteert het volgende item', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value="id-0"
        onChange={onChange}
        options={makeOptions(8)}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('id-1');
  });

  it('respecteert disabled state op de trigger', () => {
    render(<SearchableSelect value="" onChange={() => {}} options={makeOptions(4)} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('toont "Geen resultaten" bij zoekquery zonder matches', async () => {
    const user = userEvent.setup();
    render(<SearchableSelect value="" onChange={() => {}} options={makeOptions(8)} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Zoeken…'), 'zzzzz');
    expect(screen.getByText('Geen resultaten')).toBeInTheDocument();
  });

  it('sluit bij klik buiten het component', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <SearchableSelect value="" onChange={() => {}} options={makeOptions(8)} />
        <button data-testid="outside">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('skipt disabled opties bij keyboard navigation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const opts = [
      { value: 'a', label: 'Aap' },
      { value: 'b', label: 'Beer', disabled: true },
      { value: 'c', label: 'Civet' },
      { value: 'd', label: 'Dolfijn' },
      { value: 'e', label: 'Egel' },
      { value: 'f', label: 'Fret' },
    ];
    render(<SearchableSelect value="a" onChange={onChange} options={opts} />);
    await user.click(screen.getByRole('combobox'));
    // van index 0 (Aap) → ArrowDown moet naar 'c' (Civet), niet 'b'.
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('c');
  });
});
