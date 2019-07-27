// Sidebar
$('.ui.sidebar').sidebar('attach events', '.toc.item')

// Cards
$('.special.cards .image').dimmer({
  on: 'hover'
})

$(document).on('click', 'a[href^="#"]', function (event) {
  event.preventDefault()
  $('.right.item a').removeClass('active')
  $(this).addClass('active')

  $('html, body').animate(
    {
      scrollTop: $($.attr(this, 'href')).offset().top + 10
    },
    500
  )
})
