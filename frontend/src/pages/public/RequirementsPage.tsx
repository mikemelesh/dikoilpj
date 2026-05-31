import { Building2, Camera, Clock, Ruler, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const RequirementsPage = () => {
  return (
    <PublicLayout title="Требования и условия">
      <div className="max-w-4xl mx-auto">
        <div className="grid gap-8">
          {/* Photo Requirements Section */}
          <section className="bg-card rounded-xl p-6 border">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-100">
                <Camera className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold">Требования к снимкам</h2>
            </div>
            
            <div className="space-y-4 text-muted-foreground">
              <p>
                Для точного изготовления зубных протезов, ортодонтических аппаратов и других изделий 
                необходимо предоставить качественные фотографии челюстей пациента.
              </p>
              
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-primary" />
                    Общие требования к снимкам:
                  </h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Снимки должны быть четкими, без размытости и бликов</li>
                    <li>Освещение должно быть равномерным, без теней на поверхности зубов</li>
                    <li>Фотографировать нужно под разными углами: спереди, сбоку, антагонистическая артикуляция</li>
                    <li>Допускается использование зеркал для съемки жевательных поверхностей</li>
                    <li>Цветовая температура должна соответствовать дневному свету (около 5500K)</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Конкретные параметры:
                  </h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Разрешение не менее 12 мегапикселей (рекомендуется 16 МП и выше)</li>
                    <li>Формат изображения: JPG или PNG</li>
                    <li>Максимальный размер файла: 10 МБ</li>
                    <li>Минимальное количество снимков: 4 (верх, низ, боковые)</li>
                    <li>Рекомендуется делать снимки в программе CAD/CAM если возможно</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg mb-2">Дополнительные рекомендации:</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Попросите пациента открыть рот на ширину 2-3 пальцев для лучшего обзора</li>
                    <li>Избегайте использования вспышки напрямую</li>
                    <li>При необходимости используйте ретракционные нити для лучшей видимости краев</li>
                    <li>Снимки должны отражать истинные цвета зубов пациента</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
          
          {/* Manufacturing Times Section */}
          <section className="bg-card rounded-xl p-6 border">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-orange-100">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold">Сроки изготовления</h2>
            </div>
            
            <div className="space-y-4 text-muted-foreground">
              <p>
                Ниже указаны стандартные сроки изготовления различных видов ортопедических конструкций. 
                Сроки могут варьироваться в зависимости от сложности работы и объема заказа.
              </p>
              
              <div className="mt-6 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Вид изделия</th>
                      <th className="text-left py-3 px-4 font-semibold">Срок изготовления</th>
                      <th className="text-left py-3 px-4 font-semibold">Особые условия</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">Металлокерамические коронки</td>
                      <td className="py-3 px-4">7-10 рабочих дней</td>
                      <td className="py-3 px-4">При наличии 3D-скана срок может сократиться</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">Керамические виниры</td>
                      <td className="py-3 px-4">10-14 рабочих дней</td>
                      <td className="py-3 px-4">Требуется предварительное моделирование</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">Частичные съемные протезы</td>
                      <td className="py-3 px-4">10-12 рабочих дней</td>
                      <td className="py-3 px-4">Включает примерку и коррекцию</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">Полные съемные протезы</td>
                      <td className="py-3 px-4">14-21 рабочий день</td>
                      <td className="py-3 px-4">Требуется несколько этапов примерки</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">Металлический каркас бюгельного протеза</td>
                      <td className="py-3 px-4">5-7 рабочих дней</td>
                      <td className="py-3 px-4">Только каркас, без облицовки</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">Несъемные мостовидные конструкции</td>
                      <td className="py-3 px-4">7-10 рабочих дней</td>
                      <td className="py-3 px-4">В зависимости от количества элементов</td>
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="py-3 px-4">Индивидуальные каппы</td>
                      <td className="py-3 px-4">3-5 рабочих дней</td>
                      <td className="py-3 px-4">Только изготовление без наполнения</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Важная информация:</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Срочные заказы (менее 3 дней) увеличивают стоимость на 30%</li>
                  <li>Сложные конструкции могут потребовать дополнительного времени</li>
                  <li>Сроки могут быть скорректированы по согласованию с клиентом</li>
                  <li>Доставка не входит в срок изготовления и рассчитывается отдельно</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
        
        <div className="mt-12 text-center">
          <Link to="/contact">
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
              <Building2 className="h-5 w-5" />
              Связаться с нами
            </button>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            Для уточнения условий изготовления вашего заказа свяжитесь с нашими специалистами
          </p>
        </div>
      </div>
    </PublicLayout>
  );
};