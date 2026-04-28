<template>
  <section class="mortgage-calculator">
    <div class="calculator-header">
      <p class="eyebrow">Calculadora de dividendo</p>
      <h2>Simula tu crédito hipotecario en UF</h2>
      <p class="intro">
        Ajusta precio, pie, tasa y plazo para ver una estimación inmediata de tu dividendo mensual.
      </p>
    </div>

    <div class="calculator-grid">
      <div class="input-panel">
        <div class="field-group">
          <div class="field-top">
            <label for="property-price">Precio de la propiedad</label>
            <strong>{{ formatUf(propertyPriceUf) }}</strong>
          </div>
          <input
            id="property-price"
            v-model="propertyPriceUf"
            class="range-input"
            type="range"
            min="1000"
            max="30000"
            step="100"
          />
          <div class="range-scale">
            <span>UF 1.000</span>
            <span>UF 30.000</span>
          </div>
        </div>

        <div class="field-group">
          <div class="field-top">
            <label for="down-payment-uf">Pie disponible</label>
            <strong>{{ downPaymentPercent }}%</strong>
          </div>
          <div class="double-input">
            <div class="input-shell">
              <span>UF</span>
              <input
                id="down-payment-uf"
                v-model="downPaymentUfModel"
                type="number"
                min="0"
                step="10"
                inputmode="decimal"
              />
            </div>
            <div class="input-shell">
              <span>%</span>
              <input
                v-model="downPaymentPercent"
                type="range"
                min="10"
                max="40"
                step="1"
                class="range-input"
              />
            </div>
          </div>
          <div class="range-scale">
            <span>10%</span>
            <span>40%</span>
          </div>
        </div>

        <div class="field-row">
          <div class="field-group compact">
            <div class="field-top">
              <label for="annual-rate">Tasa de interés anual</label>
            </div>
            <div class="input-shell">
              <input
                id="annual-rate"
                v-model="annualRate"
                type="number"
                min="0"
                step="0.1"
                inputmode="decimal"
              />
              <span>%</span>
            </div>
          </div>

          <div class="field-group compact">
            <div class="field-top">
              <label>Plazo</label>
            </div>
            <div class="term-buttons">
              <button
                v-for="option in termOptions"
                :key="option"
                type="button"
                class="term-button"
                :class="{ active: termYears === option }"
                @click="termYears = option"
              >
                {{ option }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="result-panel">
        <div class="result-card">
          <span>Monto a financiar</span>
          <strong>{{ formatUf(loanAmountUf) }}</strong>
        </div>
        <div class="result-card standout">
          <span>Dividendo mensual</span>
          <strong>{{ formatUf(monthlyPaymentUf) }}</strong>
        </div>
        <div class="result-card">
          <span>Total pagado</span>
          <strong>{{ formatUf(totalPaidUf) }}</strong>
        </div>
        <div class="result-card">
          <span>Interés total</span>
          <strong>{{ formatUf(totalInterestUf) }}</strong>
        </div>
      </div>
    </div>

    <p class="disclaimer">
      Cálculo referencial. El dividendo real puede variar según institución financiera, seguros de
      desgravamen e incendio, comisiones y condiciones específicas del crédito.
    </p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const MIN_PRICE_UF = 1000
const MAX_PRICE_UF = 30000
const PRICE_STEP_UF = 100
const MIN_DOWN_PAYMENT_PERCENT = 10
const MAX_DOWN_PAYMENT_PERCENT = 40
const DEFAULT_RATE = 4.5
const DEFAULT_TERM_YEARS = 20

const termOptions = [10, 15, 20, 25, 30]

const propertyPriceUf = ref(5000)
const downPaymentPercent = ref(20)
const annualRate = ref(DEFAULT_RATE)
const termYears = ref(DEFAULT_TERM_YEARS)

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const roundToStep = (value, step) => Math.round(value / step) * step

const downPaymentUfModel = computed({
  get() {
    return Math.round((propertyPriceUf.value * downPaymentPercent.value) / 100)
  },
  set(value) {
    const safePrice = Math.max(propertyPriceUf.value, MIN_PRICE_UF)
    const nextUf = clamp(normalizeNumber(value, 0), 0, safePrice)
    const nextPercent = (nextUf / safePrice) * 100
    downPaymentPercent.value = Math.round(
      clamp(nextPercent, MIN_DOWN_PAYMENT_PERCENT, MAX_DOWN_PAYMENT_PERCENT)
    )
  }
})

const normalizedRate = computed(() => Math.max(normalizeNumber(annualRate.value, DEFAULT_RATE), 0))
const monthlyRate = computed(() => normalizedRate.value / 12 / 100)
const totalInstallments = computed(() => termYears.value * 12)

const loanAmountUf = computed(() => {
  const amount = propertyPriceUf.value - downPaymentUfModel.value
  return Math.max(amount, 0)
})

const monthlyPaymentUf = computed(() => {
  const principal = loanAmountUf.value
  const rate = monthlyRate.value
  const installments = totalInstallments.value

  if (!principal || !installments) return 0
  if (rate === 0) return principal / installments

  const growth = (1 + rate) ** installments
  return principal * ((rate * growth) / (growth - 1))
})

const totalPaidUf = computed(() => monthlyPaymentUf.value * totalInstallments.value)
const totalInterestUf = computed(() => Math.max(totalPaidUf.value - loanAmountUf.value, 0))

const formatUf = value =>
  `UF ${Number(value || 0).toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`

propertyPriceUf.value = roundToStep(
  clamp(propertyPriceUf.value, MIN_PRICE_UF, MAX_PRICE_UF),
  PRICE_STEP_UF
)
</script>

<style scoped>
.mortgage-calculator {
  padding: 32px;
  border-radius: 28px;
  background: linear-gradient(180deg, #ffffff 0%, #f8f4ed 100%);
  border: 1px solid rgba(15, 43, 91, 0.08);
  box-shadow: 0 20px 50px rgba(15, 43, 91, 0.08);
}

.calculator-header {
  margin-bottom: 28px;
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #b28a2f;
}

h2 {
  margin: 0;
  color: #0f2b5b;
  font-size: clamp(2rem, 3vw, 2.8rem);
  line-height: 1.05;
}

.intro {
  margin: 12px 0 0;
  max-width: 720px;
  color: #5c6f91;
  line-height: 1.6;
}

.calculator-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.9fr);
  gap: 24px;
}

.input-panel,
.result-panel {
  display: grid;
  gap: 18px;
}

.field-group {
  padding: 20px;
  border-radius: 22px;
  background: #fff;
  border: 1px solid rgba(15, 43, 91, 0.08);
}

.field-group.compact {
  height: 100%;
}

.field-row {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 18px;
}

.field-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.field-top label {
  color: #0f2b5b;
  font-weight: 700;
}

.field-top strong {
  color: #b28a2f;
  font-size: 1rem;
}

.double-input {
  display: grid;
  gap: 14px;
}

.input-shell {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: #f5f7fb;
  border: 1px solid rgba(15, 43, 91, 0.08);
}

.input-shell span {
  flex-shrink: 0;
  color: #5c6f91;
  font-weight: 700;
}

.input-shell input[type='number'] {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: #0f2b5b;
  font-size: 1rem;
  font-weight: 700;
}

.range-input {
  width: 100%;
  accent-color: #d4a940;
}

.range-scale {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  color: #8090ad;
  font-size: 0.88rem;
}

.term-buttons {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.term-button {
  border: 1px solid rgba(15, 43, 91, 0.1);
  background: #f5f7fb;
  color: #0f2b5b;
  border-radius: 14px;
  padding: 12px 10px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.2s ease;
}

.term-button.active {
  background: #0f2b5b;
  color: #fff;
  border-color: #0f2b5b;
  box-shadow: 0 10px 24px rgba(15, 43, 91, 0.2);
}

.result-card {
  padding: 22px;
  border-radius: 22px;
  background: #fff;
  border: 1px solid rgba(15, 43, 91, 0.08);
}

.result-card span {
  display: block;
  margin-bottom: 8px;
  color: #5c6f91;
  font-weight: 600;
}

.result-card strong {
  color: #0f2b5b;
  font-size: clamp(1.5rem, 2vw, 2rem);
  line-height: 1.05;
}

.result-card.standout {
  background: linear-gradient(135deg, #0f2b5b 0%, #183d7b 100%);
}

.result-card.standout span,
.result-card.standout strong {
  color: #fff;
}

.disclaimer {
  margin: 22px 0 0;
  color: #6d7d98;
  font-size: 0.92rem;
  line-height: 1.65;
}

@media (max-width: 900px) {
  .calculator-grid,
  .field-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .mortgage-calculator {
    padding: 22px;
    border-radius: 22px;
  }

  .term-buttons {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
