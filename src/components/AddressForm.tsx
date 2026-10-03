/* International address form: country first, then the fields and postcode rule for that country. */
import { COUNTRIES, Country } from '../lib/shipping'
import { AddressInput, AU_STATES, CA_PROVINCES, US_STATES } from '../lib/validate'
import { cn } from '../lib/cn'

interface Props {
  value: AddressInput
  onChange: (next: AddressInput) => void
  errors: Record<string, string>
  onBlurField?: (field: string) => void
}

export const emptyAddress = (country: Country = 'AU'): AddressInput => ({ name: '', line1: '', line2: '', city: '', region: country === 'AU' ? 'NSW' : '', postcode: '', country, phone: '' })

const JP_PREFECTURES = ['Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima', 'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa']

function TextField({ k, label, span, autoComplete, value, error, onChange, onBlur }: { k: string; label: string; span: 1 | 2; autoComplete?: string; value: string; error?: string; onChange: (v: string) => void; onBlur: () => void }) {
  return (
    <label className={cn('block', span === 2 && 'sm:col-span-2')}>
      <span className="text-[12.5px] text-ink-2">{label}</span>
      <input
        type="text"
        name={k}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `err-${k}` : undefined}
        className={cn('mt-1 h-10 w-full border bg-sheet px-3 text-[14px] text-ink', error ? 'border-fail' : 'border-rule-2 focus:border-ink')}
      />
      {error && <span id={`err-${k}`} className="mt-1 block text-[12px] text-fail">{error}</span>}
    </label>
  )
}

export function AddressForm({ value, onChange, errors, onBlurField }: Props) {
  const set = (k: keyof AddressInput, v: string) => onChange({ ...value, [k]: v })
  const c = value.country
  const regionOptions = c === 'AU' ? AU_STATES : c === 'US' ? US_STATES : c === 'CA' ? CA_PROVINCES : c === 'JP' ? JP_PREFECTURES : null
  const regionLabel = c === 'AU' || c === 'US' ? 'State' : c === 'CA' ? 'Province' : c === 'JP' ? 'Prefecture' : c === 'GB' || c === 'IE' ? 'County (optional)' : 'Region (optional)'
  const cityLabel = c === 'AU' ? 'Suburb' : c === 'GB' ? 'Town or city' : 'City'
  const postcodeLabel = c === 'US' ? 'ZIP code' : c === 'CA' || c === 'GB' || c === 'IE' ? 'Postcode' : c === 'JP' ? 'Postal code' : 'Postcode'
  const dial = COUNTRIES.find((x) => x.code === c)?.dial ?? ''

  const field = (k: keyof AddressInput, label: string, span: 1 | 2 = 1, autoComplete?: string) => (
    <TextField key={k} k={k} label={label} span={span} autoComplete={autoComplete} value={(value[k] as string) ?? ''} error={errors[k]} onChange={(v) => set(k, v)} onBlur={() => onBlurField?.(k)} />
  )

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="text-[12.5px] text-ink-2">Country</span>
        <select value={c} onChange={(e) => { const next = e.target.value as Country; onChange({ ...value, country: next, region: next === 'AU' ? 'NSW' : '', postcode: '' }) }} autoComplete="country" className="mt-1 h-10 w-full border border-rule-2 bg-sheet px-2 text-[14px] text-ink sm:max-w-[360px]">
          {COUNTRIES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
        </select>
      </label>
      {field('name', 'Full name', 2, 'name')}
      {field('line1', 'Street address', 2, 'address-line1')}
      {field('line2', 'Apartment, unit or company (optional)', 2, 'address-line2')}
      {field('city', cityLabel, 1, 'address-level2')}
      {regionOptions ? (
        <label className="block">
          <span className="text-[12.5px] text-ink-2">{regionLabel}</span>
          <select value={value.region ?? ''} onChange={(e) => set('region', e.target.value)} onBlur={() => onBlurField?.('region')} autoComplete="address-level1" aria-invalid={!!errors.region} className={cn('mt-1 h-10 w-full border bg-sheet px-2 text-[14px] text-ink', errors.region ? 'border-fail' : 'border-rule-2')}>
            <option value="">Choose</option>
            {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {errors.region && <span className="mt-1 block text-[12px] text-fail">{errors.region}</span>}
        </label>
      ) : (
        field('region', regionLabel, 1, 'address-level1')
      )}
      {field('postcode', postcodeLabel, 1, 'postal-code')}
      <label className="block">
        <span className="text-[12.5px] text-ink-2">Phone (optional{dial ? `, ${dial}` : ''})</span>
        <input type="tel" value={value.phone ?? ''} onChange={(e) => set('phone', e.target.value)} onBlur={() => onBlurField?.('phone')} autoComplete="tel" aria-invalid={!!errors.phone} className={cn('mt-1 h-10 w-full border bg-sheet px-3 text-[14px] text-ink', errors.phone ? 'border-fail' : 'border-rule-2 focus:border-ink')} />
        {errors.phone && <span className="mt-1 block text-[12px] text-fail">{errors.phone}</span>}
      </label>
    </div>
  )
}
