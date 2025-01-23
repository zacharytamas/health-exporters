import { CaffeineManager } from './CaffeineManager'
import { metricSchema } from './schema'

const data = metricSchema.array().parse([])

const [caffeineData] = data

const caffeineManager = new CaffeineManager({
  dataPoints: caffeineData.data,
})

console.log(caffeineManager.getCurrentCaffeineLevel())
