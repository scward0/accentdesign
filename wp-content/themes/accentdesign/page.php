
<?php if ( have_posts() ) : while ( have_posts() ) : the_post(); ?>

  <div class="container" style='padding: 0 5% 0 5%;'>
    <div style="background: url('<?php the_post_thumbnail_url(); ?>'); -webkit-background-size: cover; -moz-background-size: cover; -o-background-size: cover; background-size: cover;">
      <?php get_header(); ?>


      <br><br><br><br><br><br><br><br>
      <br><br><br><br><br><br><br><br>
      <br><br><br><br><br><br><br><br>
      <h1 class="text-center" style="color: white;"><?php the_title(); ?></h1>
      <?php
      $phrase = get_the_content();
      $phrase = apply_filters('the_content', $phrase);
      $replace = '<p class="text-center" style="color: white;">';
      echo str_replace('<p>', $replace, $phrase);
      ?>
      <br><br><br><br><br><br><br><br>
      <br><br><br><br><br><br><br><br>
      <br><br><br><br><br><br><br><br>
    </div>
  </div>

<?php endwhile; else : ?>

  <p><?php _e( 'Sorry, no pages found' ); ?></p>

<?php endif; ?>

<?php get_footer(); ?>
