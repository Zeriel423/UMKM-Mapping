begin;

-- Menghapus 5 titik UMKM sampel/simulasi beserta detail omset dan fotonya
delete from public.umkm_sample_details
where umkm_id in (1811, 1812, 1813, 1814, 1815)
   or umkm_id in (
     select id from public.umkm
     where name in ('Kibo Cafe', 'Odanam Burger', 'QueenJo', 'Christine Klappertaart Kairagi', 'Kios Golden')
   );

delete from public.umkm
where id in (1811, 1812, 1813, 1814, 1815)
   or name in ('Kibo Cafe', 'Odanam Burger', 'QueenJo', 'Christine Klappertaart Kairagi', 'Kios Golden');

commit;
