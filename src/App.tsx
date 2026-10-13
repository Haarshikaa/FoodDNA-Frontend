import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import './App.css'

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
)

const API = import.meta.env.VITE_API_URL || 'https://fooddna-backend.onrender.com';
type Food = {
  id: number
  food_name: string
  meal_type: string
  notes: string
  created_at: string
  serving_size_g: number | string | null
  calories: number | string | null
  protein: number | string | null
  carbs: number | string | null
  fat: number | string | null
}

type Nutrition = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

type ImageNutrition = {
  foodName: string
  servingSizeG: number
  calories: number
  protein: number
  carbs: number
  fat: number
  explanation?: string
  isEstimate?: boolean
}

const emptyNutrition: Nutrition = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
}

async function apiRequest(path: string, options?: RequestInit) {
  const response = await fetch(`${API}${path}`, options)
  const text = await response.text()

  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(
      `Server returned an unexpected response (${response.status}). Check that the correct backend is running.`
    )
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status})`)
  }

  return data
}

function numeric(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

async function compressImage(file: File, maxDimension = 900, quality = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          resolve(blob || file)
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

function App() {
  const [foods, setFoods] = useState<Food[]>([])
  const [foodName, setFoodName] = useState('')
  const [mealType, setMealType] = useState('Breakfast')
  const [notes, setNotes] = useState('')
  const [servingSize, setServingSize] = useState('100')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [insight, setInsight] = useState('')
  const [insightError, setInsightError] = useState('')
  const [generatingInsight, setGeneratingInsight] = useState(false)

  // Food photo analysis state
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoNutrition, setPhotoNutrition] = useState<ImageNutrition | null>(null)
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')

  useEffect(() => {
    if (!photo) {
      setPhotoPreview('')
      return
    }
    const previewUrl = URL.createObjectURL(photo)
    setPhotoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [photo])

  const loadFoods = useCallback(async () => {
    try {
      setError('')
      const data = await apiRequest('/api/foods')
      setFoods(data.foods)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load food records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFoods()
  }, [loadFoods])

  function resetForm() {
    setFoodName('')
    setMealType('Breakfast')
    setNotes('')
    setServingSize('100')
    setEditingId(null)
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setPhotoError('')
    setPhotoNutrition(null)

    if (!file) {
      setPhoto(null)
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Please choose a JPG, PNG, or WEBP image.')
      setPhoto(null)
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be smaller than 5 MB.')
      setPhoto(null)
      event.target.value = ''
      return
    }

    setPhoto(file)
  }

  async function analyzePhoto() {
    if (!photo) {
      setPhotoError('Choose a food photo first.')
      return
    }

    setAnalyzingPhoto(true)
    setPhotoError('')
    setPhotoNutrition(null)

    try {
      const optimizedBlob = await compressImage(photo)
      const formData = new FormData()
      formData.append('image', optimizedBlob, 'food.jpg')

      const data = await apiRequest('/api/analyze-food-image', {
        method: 'POST',
        body: formData,
      })

      setPhotoNutrition(data.nutrition)
      setFoodName(data.nutrition.foodName)
      setServingSize(String(Math.max(1, Math.round(data.nutrition.servingSizeG))))
      setStatus('Photo analyzed. Review the estimate and complete the meal form to save a journal entry.')
      document.getElementById('meal-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not analyze this photo.')
    } finally {
      setAnalyzingPhoto(false)
    }
  }

  async function saveFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setStatus('')
    setError('')

    const size = Number(servingSize)
    if (!Number.isFinite(size) || size < 1 || size > 5000) {
      setError('Serving size must be between 1 and 5000 grams.')
      setSaving(false)
      return
    }

    try {
      const payload = {
        food_name: foodName.trim(),
        meal_type: mealType,
        notes: notes.trim(),
        serving_size_g: size,
        ...(photoNutrition
          ? {
              nutrition_estimate: {
                serving_size_g: photoNutrition.servingSizeG,
                calories: photoNutrition.calories,
                protein: photoNutrition.protein,
                carbs: photoNutrition.carbs,
                fat: photoNutrition.fat,
              },
            }
          : {}),
      }

      const data = await apiRequest(
        editingId === null ? '/api/foods' : `/api/foods/${editingId}`,
        {
          method: editingId === null ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      setStatus(data.message || 'Food saved successfully!')
      resetForm()
      setPhotoNutrition(null)
      setPhoto(null)
      await loadFoods()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the food.')
    } finally {
      setSaving(false)
    }
  }

  function startEditing(food: Food) {
    setEditingId(food.id)
    setFoodName(food.food_name)
    setMealType(food.meal_type)
    setNotes(food.notes || '')
    setServingSize(String(numeric(food.serving_size_g) || 100))
    if (food.calories !== null) {
      setPhotoNutrition({
        foodName: food.food_name,
        servingSizeG: numeric(food.serving_size_g) || 100,
        calories: numeric(food.calories),
        protein: numeric(food.protein),
        carbs: numeric(food.carbs),
        fat: numeric(food.fat),
      })
    } else {
      setPhotoNutrition(null)
    }
    setStatus('')
    setError('')
    document.getElementById('meal-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function deleteFood(food: Food) {
    if (!window.confirm(`Delete "${food.food_name}" permanently?`)) return

    setError('')
    setStatus('')

    try {
      const data = await apiRequest(`/api/foods/${food.id}`, {
        method: 'DELETE',
      })
      setStatus(data.message || 'Food deleted successfully!')
      if (editingId === food.id) resetForm()
      await loadFoods()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the food.')
    }
  }

  async function generateInsights() {
    setGeneratingInsight(true)
    setInsight('')
    setInsightError('')

    try {
      const data = await apiRequest('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setInsight(data.insights || data.insight || '')
    } catch (err) {
      setInsightError(
        err instanceof Error ? err.message : 'Could not generate insights.'
      )
    } finally {
      setGeneratingInsight(false)
    }
  }

  const today = new Date().toDateString()
  const todaysFoods = foods.filter(
    (food) => new Date(food.created_at).toDateString() === today
  )

  const totals = todaysFoods.reduce<Nutrition>(
    (sum, food) => ({
      calories: sum.calories + numeric(food.calories),
      protein: sum.protein + numeric(food.protein),
      carbs: sum.carbs + numeric(food.carbs),
      fat: sum.fat + numeric(food.fat),
    }),
    { ...emptyNutrition }
  )

  const estimatedCount = todaysFoods.filter(
    (food) => food.calories !== null
  ).length

  const mealCalories = todaysFoods.reduce<Record<string, number>>(
    (acc, food) => {
      const type = food.meal_type || 'Other'
      acc[type] = (acc[type] || 0) + numeric(food.calories)
      return acc
    },
    { Breakfast: 0, Lunch: 0, Dinner: 0, Snack: 0 }
  )

  const hasMacroData = totals.protein > 0 || totals.carbs > 0 || totals.fat > 0
  const hasMealData = Object.values(mealCalories).some((cal) => cal > 0)

  const macroChartData = {
    labels: ['Protein (g)', 'Carbs (g)', 'Fat (g)'],
    datasets: [
      {
        data: [
          Number(totals.protein.toFixed(1)),
          Number(totals.carbs.toFixed(1)),
          Number(totals.fat.toFixed(1)),
        ],
        backgroundColor: ['#218653', '#e5a83b', '#e06a55'],
        borderColor: ['#175d3a', '#b58428', '#b04a39'],
        borderWidth: 1,
      },
    ],
  }

  const mealChartData = {
    labels: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
    datasets: [
      {
        label: 'Calories (kcal)',
        data: [
          Math.round(mealCalories.Breakfast || 0),
          Math.round(mealCalories.Lunch || 0),
          Math.round(mealCalories.Dinner || 0),
          Math.round(mealCalories.Snack || 0),
        ],
        backgroundColor: '#218653',
        borderRadius: 8,
      },
    ],
  }

  return (
    <div className="app">
      <header className="navbar">
        <a className="logo" href="#home">
          <span className="logo-icon">✳</span>
          <span>FoodDNA</span>
        </a>

        <nav className="nav-links">
          <a href="#home">Home</a>
          <a href="#analyze">Food Journal</a>
          <a href="#nutrition">Nutrition</a>
          <a href="#insights">AI Insights</a>
          <a href="#about">About</a>
        </nav>

        <a className="nav-cta" href="#analyze">+ Add meal</a>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <p className="tagline">YOUR FOOD. YOUR HABITS. YOUR HEALTH.</p>
            <h1>
              Get to know your <span>Food DNA.</span>
            </h1>
            <p className="description">
              Record your meals, understand estimated nutrition, and discover
              patterns in your everyday food choices.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#analyze">
                Start your food journal <span>→</span>
              </a>
              <a className="secondary-button" href="#nutrition">
                View nutrition
              </a>
            </div>
            <div className="hero-note">
              <span className="status-dot" />
              Your food records are stored in your connected database.
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-top">
              <span className="eyebrow">YOUR DAILY CHECK-IN</span>
              <span className="leaf-badge">✳</span>
            </div>
            <div className="hero-food-art">🥗</div>
            <h3>Small choices add up.</h3>
            <p>Build a clearer picture of your food habits, one meal at a time.</p>
            <div className="hero-mini-stats">
              <div><strong>{todaysFoods.length}</strong><span>Meals logged today</span></div>
              <div><strong>{Math.round(totals.calories)}</strong><span>Estimated kcal today</span></div>
            </div>
          </div>
          <div className="hero-decoration decoration-one" />
          <div className="hero-decoration decoration-two" />
        </section>

        <section className="dashboard-section" id="nutrition">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR DAILY OVERVIEW</p>
              <h2>Nutrition at a glance</h2>
              <p className="section-description">
                Totals from today's saved meals with available nutrition estimates.
              </p>
            </div>
            <span className="date-chip">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          <div className="nutrition-grid">
            <article className="nutrition-card calorie-card">
              <div className="nutrition-card-top"><span>Energy</span><span className="metric-icon">⚡</span></div>
              <div className="metric-value">{Math.round(totals.calories)} <small>kcal</small></div>
              <p>Estimated calories</p>
            </article>
            <article className="nutrition-card">
              <div className="nutrition-card-top"><span>Protein</span><span className="metric-icon">◈</span></div>
              <div className="metric-value">{totals.protein.toFixed(1)} <small>g</small></div>
              <p>From logged meals</p>
            </article>
            <article className="nutrition-card">
              <div className="nutrition-card-top"><span>Carbohydrates</span><span className="metric-icon">⌁</span></div>
              <div className="metric-value">{totals.carbs.toFixed(1)} <small>g</small></div>
              <p>From logged meals</p>
            </article>
            <article className="nutrition-card">
              <div className="nutrition-card-top"><span>Fat</span><span className="metric-icon">◉</span></div>
              <div className="metric-value">{totals.fat.toFixed(1)} <small>g</small></div>
              <p>From logged meals</p>
            </article>
          </div>

          <div className="charts-grid">
            <article className="chart-card">
              <div className="chart-card-top">
                <h3>Macronutrient Breakdown</h3>
                <span className="chart-badge">Daily Ratio</span>
              </div>
              <div className="chart-container">
                {hasMacroData ? (
                  <Doughnut
                    data={macroChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' },
                      },
                    }}
                  />
                ) : (
                  <div className="chart-empty">
                    <p>Log a meal today to view your macronutrient distribution.</p>
                  </div>
                )}
              </div>
            </article>

            <article className="chart-card">
              <div className="chart-card-top">
                <h3>Calories by Meal Type</h3>
                <span className="chart-badge">Meal Breakdown</span>
              </div>
              <div className="chart-container">
                {hasMealData ? (
                  <Bar
                    data={mealChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { precision: 0 },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="chart-empty">
                    <p>Log meals to see calorie distribution across the day.</p>
                  </div>
                )}
              </div>
            </article>
          </div>

          <p className="nutrition-disclaimer">
            Nutrition figures are estimates for supported foods, not medical advice.
            Unknown foods are excluded from the totals until nutrition data is available.
            {estimatedCount === 0 && ' Add a supported food to see estimated nutrition.'}
          </p>
        </section>

        <section className="journal-section" id="analyze">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR PERSONAL FOOD LOG</p>
              <h2>Analyze a food photo</h2>
              <p className="section-description">
                Upload a clear picture of your meal to estimate its portion and nutrition.
              </p>
            </div>
            <span className="section-emoji">📷</span>
          </div>

          <div className="food-form photo-upload-panel">
            <div className="form-field">
              <label htmlFor="food-photo">Choose a food photo</label>
              <input
                id="food-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={choosePhoto}
              />
              <small>JPG, PNG, or WEBP. Maximum file size: 5 MB.</small>
            </div>

            {photoPreview && (
              <div className="photo-preview-wrap">
                <img className="food-photo-preview" src={photoPreview} alt="Selected food" />
              </div>
            )}

            {photoError && <p className="notice error-notice" role="alert">{photoError}</p>}

            <div className="form-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void analyzePhoto()}
                disabled={!photo || analyzingPhoto}
              >
                {analyzingPhoto ? 'Analyzing photo...' : 'Analyze food photo →'}
              </button>
            </div>

            {photoNutrition && (
              <div className="photo-results" aria-live="polite">
                <p className="eyebrow">ESTIMATED PHOTO RESULTS</p>
                <h3>{photoNutrition.foodName}</h3>
                <p>Estimated portion: {Math.round(photoNutrition.servingSizeG)} g</p>
                <div className="nutrition-grid photo-nutrition-grid">
                  <article className="nutrition-card calorie-card">
                    <div className="nutrition-card-top"><span>Energy</span></div>
                    <div className="metric-value">{Math.round(photoNutrition.calories)} <small>kcal</small></div>
                  </article>
                  <article className="nutrition-card">
                    <div className="nutrition-card-top"><span>Protein</span></div>
                    <div className="metric-value">{photoNutrition.protein.toFixed(1)} <small>g</small></div>
                  </article>
                  <article className="nutrition-card">
                    <div className="nutrition-card-top"><span>Carbohydrates</span></div>
                    <div className="metric-value">{photoNutrition.carbs.toFixed(1)} <small>g</small></div>
                  </article>
                  <article className="nutrition-card">
                    <div className="nutrition-card-top"><span>Fat</span></div>
                    <div className="metric-value">{photoNutrition.fat.toFixed(1)} <small>g</small></div>
                  </article>
                </div>
                {photoNutrition.explanation && <p className="nutrition-disclaimer">{photoNutrition.explanation}</p>}
                <p className="nutrition-disclaimer">
                  These are image-based estimates. The camera cannot reliably reveal exact weight,
                  ingredients, or cooking oil. Review the values before relying on them.
                </p>
              </div>
            )}
          </div>

          <div className="section-heading meal-form-heading" id="meal-form">
            <div>
              <p className="eyebrow">YOUR PERSONAL FOOD LOG</p>
              <h2>{editingId === null ? 'Record a meal' : 'Edit your meal'}</h2>
              <p className="section-description">
                Save what you ate and keep your food history in one place.
              </p>
            </div>
            <span className="section-emoji">🍃</span>
          </div>

          <form className="food-form" onSubmit={saveFood}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="food-name">Food name</label>
                <input
                  id="food-name"
                  value={foodName}
                  onChange={(event) => setFoodName(event.target.value)}
                  placeholder="e.g. dosa, idli, rice"
                  maxLength={150}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="meal-type">Meal type</label>
                <select id="meal-type" value={mealType} onChange={(event) => setMealType(event.target.value)}>
                  <option>Breakfast</option>
                  <option>Lunch</option>
                  <option>Dinner</option>
                  <option>Snack</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="serving-size">Serving size (grams)</label>
                <input
                  id="serving-size"
                  type="number"
                  min="1"
                  max="5000"
                  value={servingSize}
                  onChange={(event) => setServingSize(event.target.value)}
                  required
                />
                <small>Nutrition estimates use this serving size.</small>
              </div>

              <div className="form-field">
                <label htmlFor="food-notes">Notes (optional)</label>
                <input
                  id="food-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ingredients or meal details"
                  maxLength={2000}
                />
              </div>
            </div>

            {status && <p className="notice success-notice" role="status">{status}</p>}
            {error && <p className="notice error-notice" role="alert">{error}</p>}

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingId === null ? 'Save food record →' : 'Update food record →'}
              </button>
              {editingId !== null && (
                <button className="secondary-button" type="button" onClick={resetForm}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="history-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR FOOD HISTORY</p>
              <h2>Saved meals</h2>
              <p className="section-description">
                {foods.length} {foods.length === 1 ? 'record' : 'records'} saved in your journal.
              </p>
            </div>
            <button className="secondary-button" onClick={() => void loadFoods()} type="button">
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <div className="empty-state">Loading your food records...</div>
          ) : foods.length === 0 ? (
            <div className="empty-state">
              <span>🥑</span>
              <h3>Your food story starts here.</h3>
              <p>Add your first meal using the form above.</p>
            </div>
          ) : (
            <div className="food-grid">
              {foods.map((food) => {
                const hasNutrition = food.calories !== null
                return (
                  <article className="food-card" key={food.id}>
                    <div className="food-card-top">
                      <span className="food-card-icon">🍽️</span>
                      <span className="meal-pill">{food.meal_type}</span>
                    </div>
                    <h3>{food.food_name}</h3>
                    <p className="food-date">{new Date(food.created_at).toLocaleString()}</p>
                    <div className="serving-line">
                      Serving: {numeric(food.serving_size_g) || 100} g
                    </div>

                    {hasNutrition ? (
                      <div className="food-nutrition">
                        <div><strong>{Math.round(numeric(food.calories))}</strong><span>kcal</span></div>
                        <div><strong>{numeric(food.protein).toFixed(1)}g</strong><span>Protein</span></div>
                        <div><strong>{numeric(food.carbs).toFixed(1)}g</strong><span>Carbs</span></div>
                        <div><strong>{numeric(food.fat).toFixed(1)}g</strong><span>Fat</span></div>
                      </div>
                    ) : (
                      <p className="unknown-nutrition">Nutrition estimate unavailable for this food.</p>
                    )}

                    {food.notes && <p className="food-notes">{food.notes}</p>}

                    <div className="food-card-actions">
                      <button className="edit-button" onClick={() => startEditing(food)} type="button">✎ Edit</button>
                      <button className="delete-button" onClick={() => void deleteFood(food)} type="button">Delete</button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="insights-section" id="insights">
          <div className="insights-banner">
            <div className="insight-symbol">✳</div>
            <div className="insight-copy">
              <p className="eyebrow">YOUR PERSONAL FOOD COMPANION</p>
              <h2>Turn your food log into insights.</h2>
              <p>
                Explore meal patterns and practical suggestions based on your saved records.
                These insights are generated locally from your food journal.
              </p>
            </div>
            <button className="light-button" type="button" onClick={() => void generateInsights()} disabled={generatingInsight}>
              {generatingInsight ? 'Generating...' : 'Generate insights →'}
            </button>
          </div>

          {insightError && <p className="notice error-notice" role="alert">{insightError}</p>}
          {insight && (
            <article className="insight-result">
              <h3>Your food insights</h3>
              <p>{insight}</p>
              <small>Based on your saved food records. Estimates may be inaccurate.</small>
            </article>
          )}
        </section>

        <section className="about-section" id="about">
          <p className="eyebrow">A MORE MINDFUL WAY TO EAT</p>
          <h2>Better awareness, one meal at a time.</h2>
          <p>
            FoodDNA helps you build awareness of your eating habits through
            consistent tracking and transparent nutrition estimates.
          </p>
        </section>
      </main>

      <footer className="footer">
        <a className="logo footer-logo" href="#home"><span className="logo-icon">✳</span> FoodDNA</a>
        <p>© 2026 FoodDNA. Understand your food. Understand yourself.</p>
      </footer>
    </div>
  )
}

export default App
