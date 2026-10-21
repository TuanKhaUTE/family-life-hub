update public.notifications
set
  title = 'Đã mua bữa sáng',
  message = case
    when message = 'Breakfast has been purchased.'
      then 'Mẹ đã mua bữa sáng rồi nhé.'
    else message
  end
where type = 'BREAKFAST_PURCHASED'
  and related_resource_type = 'BREAKFAST_PURCHASE';
