<?php

/*
  Template Name: Projects
*/

?>

<div class="container">
  <div style="background: url('<?php the_post_thumbnail_url(); ?>'); height: 100%; background-attachment: fixed; background-position: center; background-repeat: no-repeat; background-size: cover;" >
    <?php get_header(); ?>
    <div class="headline">
      <?php if ( have_posts() ) : while ( have_posts() ) : the_post(); ?>
      <h1 class="text-center" style="color: white; font-size: 50px; text-transform:uppercase;"><?php the_title(); ?></h1>
      <?php
      $phrase = get_the_content();
      $phrase = apply_filters('the_content', $phrase);
      $replace = '<p class="text-center" style="color: white;">';
      echo str_replace('<p>', $replace, $phrase);
      ?>
    <?php endwhile;  endif;?>
    </div>
    <div class="arrow">
      <img src="http://198.58.102.147/accentdesign/wp-content/uploads/2016/12/arrow-down@2x.png" alt="Arrow Down" width="100px" style="position: absolute; top: 90%; left: 50%; transform: translateX(-50%) translateY(-50%);" />
    </div>
  </div>
</div>


<?php
$args = array(
  'post_type' => 'project'
);
$query = new WP_Query ($args);

 ?>

 <section class="row no-max collapse" id='projects'>
   <?php if( $query->have_posts() ) : while($query->have_posts() ) : $query->the_post(); ?>
     <div class="small-12 medium-6 large-6 columns " style="padding: 0; margin: 0;">
     <style>
       .project-image:hover{ background: black;}
       .project-image:hover img{ opacity:0.5;}
       .project-image:hover h1{display:block !important; font-size:400%; text-transform: uppercase; text-align: center; position: absolute; top: 30%; width: 100%; color: white;}
       @media screen and (max-width: 768px){
         .project-image{ background: black;}
         .project-image img{ opacity:0.5;}
         .project-image h1{display:block !important; font-size:400%; text-transform: uppercase; text-align: center; position: absolute; top: 30%; width: 100%; color: white;}
       }
     </style>
       <div class="project-image" style="padding: 0; margin: 0;">
         <a href="<?php the_permalink(); ?>"><?php the_post_thumbnail('large'); ?></a>
         <h1 style="display: none; "><?php the_title(); ?></h1><br>
       </div>
     </div>
   <?php endwhile; endif; wp_reset_postdata(); ?>
 </section>

<?php get_footer(); ?>
